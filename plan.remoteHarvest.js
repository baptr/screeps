const pathUtil = require('util.pathing');
const splay = require('util.splay');

const scout = require('role2.scout');
const roadWorker = require('role2.roadWorker');
const keeperKiller = require('role2.keeperKiller');
const reserver = require('role2.reserver');
const dropHarvester = require('role2.dropHarvester');

/*
// Empirically, 3:1 strikes a good balance between path length and road maintenance cost.
[room E28S12 pos 18,19] -> [room E29S13 pos 37,36] with plainCost=1, swampCost=1 (1 ratio) takes 301 steps including 177 swamp tiles. ops=1598
[room E28S12 pos 18,19] -> [room E29S13 pos 37,36] with plainCost=2, swampCost=3 (1.5 ratio) takes 307 steps including 129 swamp tiles. ops=5228
[room E28S12 pos 18,19] -> [room E29S13 pos 37,36] with plainCost=1, swampCost=2 (2 ratio) takes 310 steps including 123 swamp tiles. ops=4529
[room E28S12 pos 18,19] -> [room E29S13 pos 37,36] with plainCost=1, swampCost=3 (3 ratio) takes 312 steps including 121 swamp tiles. ops=4893
[room E28S12 pos 18,19] -> [room E29S13 pos 37,36] with plainCost=1, swampCost=4 (4 ratio) takes 312 steps including 121 swamp tiles. ops=5024
[room E28S12 pos 18,19] -> [room E29S13 pos 37,36] with plainCost=1, swampCost=5 (5 ratio) takes 323 steps including 118 swamp tiles. ops=5088
*/
const testOpts = [
  //[1, 1, '#ffffff'],
  //[2, 3, '#ffcccc'],
  //[1, 2, '#ffaaaa'],
  [2, 6, '#ff7777'],
  //[1, 4, '#ff4444'],
  //[1, 5, '#ff1111'],
];

function roomMatrix(name) {
  const room = Game.rooms[name];
  if(!room) return undefined;

  const out = new PathFinder.CostMatrix;
  for(const s of room.find(FIND_STRUCTURES)) {
    if(s.structureType == STRUCTURE_ROAD) {
      out.set(s.pos.x, s.pos.y, 1);
    } else if(s.structureType == STRUCTURE_WALL) {
      out.set(s.pos.x, s.pos.y, 255);
    } else if(s.structureType == STRUCTURE_RAMPART && !s.my) {
      out.set(s.pos.x, s.pos.y, 255);
    }
  }
  for(const s of room.find(FIND_CONSTRUCTION_SITES)) {
    if(s.structureType == STRUCTURE_ROAD) {
      out.set(s.pos.x, s.pos.y, 1);
    }
  }
  return out;
}

function swampRoads(src, dst, range=0, opts={}) {
  const macroPath = pathUtil.macroPath(src.roomName, dst.roomName, opts.badRooms);
  if(!macroPath) {
    console.log(`unable to find map route between ${src.roomName} and ${dst.roomName}`);
  }
  const macroRooms = macroPath.map(e => e.room);
  macroRooms.push(src.roomName);

  const p = opts.plainCost || 2;
  const s = opts.swampCost || 6;

  const ret = PathFinder.search(src, {pos: dst, range}, {plainCost: p, swampCost: s, maxOps: 10000,
    roomCallback: name => macroRooms.includes(name) ? roomMatrix(name) : false});
  if(opts.drawViz) Memory.mapViz = Game.map.visual.poly(ret.path).export();
  let swampSteps = 0;
  let roadSteps = 0;
  for(const pos of ret.path) {
    const room = Game.rooms[pos.roomName];
    let road;
    if(room) {
      road = room.lookForAt(LOOK_STRUCTURES, pos).find(s => s.structureType == STRUCTURE_ROAD);
      if(road) {
        roadSteps++;
      }
    }
    // TODO: memoize the terrain blob?
    if(Game.map.getRoomTerrain(pos.roomName).get(pos.x, pos.y) == TERRAIN_MASK_SWAMP) {
      swampSteps++;
      if(opts.build && !ret.incomplete && !road) {
        if(Game.rooms[pos.roomName]) pos.createConstructionSite(STRUCTURE_ROAD);
      }
    }
  }
  if(ret.incomplete) {
    console.log(JSON.stringify(ret));
  }
  console.log(`${src} -> ${dst} with plainCost=${p}, swampCost=${s} (${s/p} ratio) takes ${ret.path.length} steps including ${swampSteps} swamp tiles over ${roadSteps} existing visible roads. ops=${ret.ops}`);
  const roomLines = ret.path.reduce(
    (out, pos) => {
      if(pos.roomName == out.lastRoom) {
        out.cur.push(pos);
      } else {
        if(out.cur) {
          out.lines.push(out.cur);
        }
        out.cur = [pos];
        out.lastRoom = pos.roomName;
      }
      return out;
    },
    {lines: [], swampSteps: 0}
  );
  if(roomLines.cur) roomLines.lines.push(roomLines.cur);

  if(opts.drawViz) {
    const roomViz = {};
    for(const l of roomLines.lines) {
      const r = l[0].roomName;
      let viz = roomViz[r];
      if(!viz) {
         viz = new RoomVisual(r); //.clear();
         roomViz[r] = viz;
      }
      viz.poly(l, {opacity: 0.25});
    }
    for(const r in roomViz) {
      Memory.viz[r] = roomViz[r].export();
    }
  }
  return macroPath;
}

function plan(roomName) {
  if(Game.time % 10 != 0) return;
  if(!splay.isTurn('plan.remoteHarvest', roomName, Game.time/10)) return;

  const room = Game.rooms[roomName];
  if(!room) {
    if(Game.time % 100 == 0) console.log(`Lost visibility to ${roomName} for remote harvesting`);
    if(!scout.exists(roomName)) scout.spawn(roomName);
    return
  }

  // TODO There's probably a better place for invader core elimination to live,
  // but harvested rooms are the most annoying so far.
  const blockers = room.find(FIND_HOSTILE_STRUCTURES);
  if(blockers.length && keeperKiller.assigned(roomName) < 3) {
    const ret = keeperKiller.spawn(Game.spawns.Home, roomName);
    if(ret != ERR_NOT_ENOUGH_ENERGY) console.log(`remoteHarvest.plan[${roomName}] trying to spawn keeperKiller for ${blockers}: ${ret}`);
    return ret;
  }

  // A: do we need to unreserve so we can use it?
  // B: do we need to positively reserve to keep the workers busy?
  const ctrl = room.controller;
  const rsvs = reserver.assigned(roomName).filter(c => c.ticksToLive > 100);
  if(ctrl.reservation && ctrl.reservation.username != 'baptr') {
    if(rsvs.length < 2 && ctrl.reservation.ticksToEnd > 100) {
      const spawn = Game.spawns.Home; // XXX make this dynamic (everywhere)
      const ret = reserver.spawn(spawn, roomName);
      if(ret != ERR_NOT_ENOUGH_ENERGY) console.log(`remoteHarvest.plan[${roomName}] spawning reserver over ${ctrl.reservation.username}: ${ret}`);
      return ret;
    }
  }
  if(rsvs.length < 2) {
    // TODO: store this decision? (but update as workers get bigger..)
    const harvesters = dropHarvester.assigned(roomName);
    // XXX...
  }

  for(const src of room.find(FIND_SOURCES)) {
    const exist = roadWorker.assigned(src.pos);
    if(!exist.length) {
      const ret = roadWorker.spawn(Game.spawns.Home, src.pos);
      console.log(`remoteHarvest.plan[${roomName}] trying to spawn a new road worker for ${src}: ${ret}`);
      return ret;
    }
  }
}

module.exports = {
  swampRoads,
  plan,
};
