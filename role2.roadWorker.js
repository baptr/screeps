const BodyBuilder = require('util.bodybuilder');
const creepUtil = require('util.creep');
const roadUtil = require('util.road');

const ROLE = 'roadWorker';

function resourcePos(src) {
  const loose = src.findInRange(FIND_DROPPED_RESOURCES, 2, {filter: r => r.resourceType == RESOURCE_ENERGY});
  const conts = src.findInRange(FIND_STRUCTURES, 2, {filter: s => s.structureType == STRUCTURE_CONTAINER && s.store.energy > 0});

  const out = {};
  for(const r of loose) {
    out[r.pos] = {pos: r.pos, amount: r.amount, loose: r};
  }
  for(const c of conts) {
    if(!out[c.pos]) out[c.pos] = {pos: c.pos, amount: 0};
    out[c.pos].amount += c.store.energy;
    out[c.pos].cont = c;
  }
  return Object.values(out).sort((a, b) => b.amount - a.mount).shift();
}

function startBuilding(creep) {
  creep.memory.building = true;
  const cs = creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES); // maybe filter for roads only, but meh
  if(cs) {
    creep.memory.build = cs.id;
    if(creep.pos.getRangeTo(cs.pos) <= 3) {
      return creep.build(cs);
    } else {
      return roadUtil.move(creep, cs.pos);
    }
  } else {
    // Start heading home, hopefully there's something to build in another room
    // along the way.
    const spawn = Game.getObjectById(creep.memory.spawn);
    if(!creep.pos.isNearTo(spawn)) {
      return roadUtil.move(creep, spawn);
    }
    // Head back out, maybe repair along the way.
    creep.transfer(spawn, RESOURCE_ENERGY);
    creep.memory.building = false;
  }
}

module.exports = {
assigned: function(srcPos) {
  return Object.values(Game.creeps).filter(c => {
    if(c.memory.role != ROLE) return false;
    const target = c.memory.srcPos;
    if(target.roomName != srcPos.roomName) return false;
    return srcPos.isEqualTo(target.x, target.y);
  });
},
spawn: function(spawn, srcPos) {
  const body = new BodyBuilder([], spawn.room.energyAvailable);
  body.extend([MOVE, MOVE, WORK, CARRY]);

  if(body.count(WORK) < 2) return ERR_NOT_ENOUGH_ENERGY;

  const name = `${ROLE}-${spawn.room.name}-${Game.time}`;
  spawn.spawnCreep(body.body, name, {memory: {
    role: ROLE,
    cost: body.cost,
    spawn: spawn.id,
    srcPos,
  }});
},
run: function(creep) {
  if(creep.memory.filling && creep.store.getFreeCapacity() == 0) {
    creep.memory.building = true;
  } else if(!creep.memory.filling && creep.store.energy == 0) {
    creep.memory.building = false;
  }

  if(creep.memory.building) { // build
    // TODO: Maybe try to avoid travelling far with little energy when you
    // could go a different way to get more first.

    let site = Game.getObjectById(creep.memory.build);
    if(!site) {
      startBuilding(creep);
    } else {
      if(creep.pos.getRangeTo(site.pos) > 3) {
        roadUtil.move(creep, site.pos);
      } else {
        // Return here to avoid also trying to repair this tick.
        return creep.build(site);
      }
    }

    // Try some repairs on the way.
    const repairPower = creepUtil.bodyPower(creep, WORK, REPAIR_POWER);
    const rep = creep.pos.findInRange(FIND_STRUCTURES, 3, {
      filter: s => s.structureType == STRUCTURE_ROAD && s.hits + repairPower <= s.hitsMax}).shift();
    if(rep) creep.repair(rep);
    return OK;
  } else { // fill
    const rawPos = creep.memory.srcPos; // only ever the actual Source
    if(!rawPos) {
      console.log(`${creep.name} lost src??? mem dump: ${JSON.stringify(creep.memory)}`);
      return;
    }
    const srcPos = new RoomPosition(rawPos.x, rawPos.y, rawPos.roomName);

    if(creep.pos.roomName != srcPos.roomName) {
      const loose = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {filter: r => r.resourceType == RESOURCE_ENERGY});
      if(loose) {
        if(creep.pos.isNearTo(loose)) {
          creep.pickup(loose);
        } else {
          creep.moveTo(loose);
        }
      }
      return roadUtil.move(creep, srcPos);
    }
    const srcRange = creep.pos.getRangeTo(srcPos);
    if(srcRange > 2) {
      return roadUtil.move(creep, srcPos);
    }

    let space = creep.store.getFreeCapacity();
    const resLoc = resourcePos(srcPos);
    if(!resLoc) { // Try to harvest if there's room.
      if(srcRange > 1) return roadUtil.move(creep, srcPos);
      const src = creep.room.lookForAt(LOOK_SOURCES, srcPos).shift();
      return creep.harvest(src);
    }
    if(creep.pos.getRangeTo(resLoc.pos) > 1) {
      return roadUtil.move(creep, resLoc.pos);
    }
    if(resLoc.loose) {
      if(creep.pickup(resLoc.loose) == OK) {
        space -= Math.min(resLoc.loose.amount);
      }
    }
    if(space > 0 && resLoc.cont) {
      const draw = Math.min(resLoc.cont.store.energy, space);
      // XXX does this error if you withdraw more than is available?
      if(creep.withdraw(resLoc.cont, RESOURCE_ENERGY, draw) == OK) {
        space -= draw;
      }
    }
    if(space == 0) {
      return startBuilding(creep);
    }
    return OK;
  }
}
};
