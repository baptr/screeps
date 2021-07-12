const local = require('local');
/* TODOs:
   - Treat planned roads as cheaper during multiple passes.
*/

function longPath(srcPos, dstPos, opts={}) {
  opts = Object.assign({}, {range: 1, cache: true, plainCost: 1, swampCost: 5, maxCost: CREEP_LIFE_TIME, maxOps: 10000}, opts);
  let cacheKey;
  if(opts.cache) {
    if(!global.longPath) {
      console.log("Lost longPath cache, initializing");
      global.longPath = {};
    }
    cacheKey = `${srcPos.roomName}:${srcPos.x},${srcPos.y}-${dstPos.roomName}:${dstPos.x},${dstPos.y}:${opts.plainCost},${opts.swampCost}`;
    // TTL, pruning?
    if(global.longPath[cacheKey]) return global.longPath[cacheKey];
  }
  let macro = opts.macroPath;
  if(!macro) {
    macro = macroPath(srcPos.roomName, dstPos.roomName, undefined, undefined, opts.swampCost);
    if(macro == ERR_NO_PATH) {
      if(opts.cache) global.longPath[cacheKey] = ERR_NO_PATH;
      return ERR_NO_PATH;
    }
  }
  const rooms = macro.map(step => step.room).concat(srcPos.roomName);
  const path = PathFinder.search(srcPos, {pos: dstPos, range: opts.range}, {
    maxCost: opts.maxCost,
    maxOps: opts.maxOps,
    plainCost: opts.plainCost,
    swampCost: opts.swampCost,
    // TODO: use scouted/visible matricies?
    roomCallback: name => rooms.includes(name) ? undefined : false,
  });
  if(opts.cache) {
    global.longPath[cacheKey] = path;
  }
  return path;
}

function travelCost(creep) {
  // TODO: Handle MOVE/CARRY boosts.
  // TODO: Better planning for laden/unladen.
  let weight = Math.ceil(creep.store.getUsedCapacity() / CARRY_CAPACITY)
  let strength = 0;
  for(const b of creep.body) {
    if(b.hits == 0) continue;
    if(b.type == MOVE) {
      strength += 2;
    } else if(b.type != CARRY) {
      weight++;
    }
  }
  return {
    plainCost: Math.max(Math.ceil(2*weight/strength), 1),
    swampCost: Math.max(Math.ceil(5*weight/strength), 1),
  };
}

function macroPath(srcRoom, dstRoom, badRooms=local.badRooms||[], badCost=Infinity, swampCost=3) {
  return Game.map.findRoute(srcRoom, dstRoom, {
    routeCallback: name => {
      if(badRooms.includes(name)) return badCost;
      if(name.includes('0')) return 1;
      return swampCost; // maybe even higher in season since there are so many swamps
    }});
}

function roomCallback(roomName) {
    const room = Game.rooms[roomName];
    if(!room) return undefined;

    const out = new PathFinder.CostMatrix();
    const buildings = room.find(FIND_STRUCTURES);
    for(const s of buildings) {
      if(OBSTACLE_OBJECT_TYPES.includes(s.structureType)) {
        out.set(s.pos.x, s.pos.y, 255);
      } else if(s.structureType == STRUCTURE_ROAD) {
        out.set(s.pos.x, s.pos.y, 1);
      } else if(s.structureType == STRUCTURE_RAMPART && !s.my) {
        out.set(s.pos.x, s.pos.y, 255);
      }
    };
    return out;
}

module.exports = {
roomCallback,
swampCheck: function(src, dest, roomMatrix=null) {
    // XXX will break if this ever tries to span a room.
    // TODO(baptr): Presumably there could be cases where leaving the room
    // could give a better path.
    if(!roomMatrix) {
        roomMatrix = roomCallback(src.roomName);
    }
    var vis = (Game.rooms[src.roomName] || {}).visual;
    if(!vis) {
        console.log('Warning: unable to see for path planning '+src.roomName);
        vis = new RoomVisual(src.roomName);
    }
    // TODO(baptr): Safe to always assume range: 1? I think so.
    // Should be even further for controllers, since they have 3 upgrade range.
    // TODO(baptr): Doesn't handle return trips from controllers...
    var range = 1;
    if(dest instanceof StructureController) {
        range = 3;
    }
    var res = PathFinder.search(src, {pos: dest, range: range}, {roomCallback: () => roomMatrix, swampCost: 2, maxRooms: 1});
    var ret = [];
    var cloneMatrix = roomMatrix.clone();
    // TODO(baptr): can't short-cut the first pass on swamp traversal.
    //if(res.path.length < res.cost) { // Ended up traversing a swamp!
    _.forEach(res.path, (p, i) => {
        // Pretend there's a creep in the way for the next pass.
        cloneMatrix.set(p.x, p.y, 5);
        var prev = res.path[i-1] || src;
        var t = p.lookFor(LOOK_TERRAIN)[0];
        if(t == 'swamp') {
            // TODO(baptr): Ignore it if there's already a road there??
            ret.push(p);
            vis.line(prev, p, {color: '#55ff11'})
        } else {
            vis.line(prev, p);
        }
    })
    //}
    // Do another pass with the first path soft-blocked (by creeps)
    var cloneRes = PathFinder.search(src, {pos: dest, range: 1}, {roomCallback: () => cloneMatrix, swampCost: 2, maxRooms: 1});
    // TODO(baptr): The second pass can be short-circuited, but then you lose visualization.
    //if(cloneRes.path.length < cloneRes.cost) { // Hit another swamp, or had to wait for a creep to move
        _.forEach(cloneRes.path, (p, i) => {
            var prev = cloneRes.path[i-1] || src;
            var t = p.lookFor(LOOK_TERRAIN)[0];
            if(t == 'swamp') {
                ret.push(p);
                vis.line(prev, p, {color: '#11aa00'});
            } else {
                vis.line(prev, p, {color: '#555555'});
            }
        });
    //}
    return ret;
},
// return the number of walkable spaces adjacent to the provided room position.
spacesNear: function(pos, range = 1, ignoreCreeps = true) {
    var room = Game.rooms[pos.roomName];
    var area = room.lookAtArea(pos.y-range, pos.x-range, pos.y+range, pos.x+range, false);
    var free = [];
    for(var y = pos.y-range; y <= pos.y+range; y++) {
        for(var x = pos.x-range; x <= pos.x+range; x++) {
            if(!area[y][x]) {
                console.log(`spacesNear(${pos}): missing ${x}, ${y}`);
                continue;
            }
            var blocked = false;
            for(var i = 0; i < area[y][x].length; i++) {
                var o = area[y][x][i];
                var t = o.type;
                switch(t) {
                case LOOK_STRUCTURES:
                case LOOK_CONSTRUCTION_SITES:
                    t = o[t].structureType;
                    break;
                case LOOK_TERRAIN:
                    t = o[t];
                    break;
                case LOOK_CREEPS:
                    if(ignoreCreeps) continue;
                }
                
                if(t == 'wall') {
                    // soft blocked, unless there's also a road...
                    blocked = true;
                    room.visual.rect(x-0.5, y-0.5, 1, 1, {fill: "#ff5555", opacity: 0.25});
                }
                if(blocked && t == STRUCTURE_ROAD && o.type == LOOK_STRUCTURES) {
                    blocked = false;
                    room.visual.rect(x-0.5, y-0.5, 1, 1, {fill: "#55ff55", opacity: 0.25});
                }
                if(OBSTACLE_OBJECT_TYPES.includes(t)) {
                    blocked = true;
                    room.visual.rect(x-0.5, y-0.5, 1, 1, {fill: "#ff0000", opacity: 0.25});
                    break;
                }
            }
            if(!blocked) {
                room.visual.rect(x-0.5, y-0.5, 1, 1, {fill: "#00ff00", opacity: 0.25});
                var p = room.getPositionAt(x, y);
                if(p) { // Ignore out of bounds.
                    free.push(p);
                }
            }
        }
    }
    // TOOD(baptr): Sort by linear distance from the target?
    return free;
},
visPath: function(path) {
    var roomVis;
    var lastRoom;
    for(let i = 1; i < path.length; i++) {
        let prev = path[i-1];
        let cur = path[i];
        if(prev.roomName != cur.roomName) continue;
        if(cur.roomName != lastRoom) {
            lastRoom = cur.roomName;
            roomVis = new RoomVisual(cur.roomName);
        }
        roomVis.line(prev, cur);
    }
},
macroPath,
macroMove: function(creep, moveOpts = {}) {
  // XXX compare pathfinding the whole route with available rooms limited to the macroPath.
  // Or maybe always path 2 rooms ahead?
  const roomPath = creep.memory.roomPath;
  if(roomPath) { // XXX deprecated
    let hop = roomPath[0];
    if(creep.room.name == hop.room) {
      roomPath.shift();
      hop = roomPath[0];
      if(!hop) delete creep.memory.roomPath;
    }
    if(hop) {
      const exit = creep.pos.findClosestByPath(hop.exit);
      // TODO: Handle it being cheaper to leave the room and come back through a
      // different entrance.
      return creep.moveTo(exit, Object.assign({visualizePathStyle: {}, reusePath: 50, maxRooms: 1}, moveOpts));
    }
    return creep.moveTo(25, 25, Object.assign({maxRooms: 1}, moveOpts));
  }

  const exitPath = creep.memory.exitPath;
  if(exitPath) {
    let hop = exitPath[0];
    if(creep.pos.roomName == hop.roomName) {
      exitPath.shift();
      hop = exitPath[0];
      if(!hop) delete creep.memory.exitPath;
    }
    if(hop) {
      return creep.moveTo(new RoomPosition(hop.x, hop.y, hop.roomName), 
        Object.assign({visualizePathStyle: {}, reusePath: 50, maxRooms: 1}, moveOpts));
    }
    console.log(`${creep.name} arrived in ${creep.pos.roomName} with ${creep.ticksToLive} ticks remaining!`);
    return creep.moveTo(25, 25, Object.assign({maxRooms: 1}, moveOpts));
  }

  console.log(`${creep.name} trying to macroMove with no stored path`);
  return ERR_NO_PATH;
},
macroClosest: function(srcRoom, goals, opts={}) {
    let goal = ERR_NO_PATH;
    let bestPath;
    for(const g of goals) {
      const path = macroPath(srcRoom, g.pos.roomName, opts.badRooms, opts.badCost);
      if(bestPath && path.length >= bestPath.length) continue;
      bestPath = path;
      goal = g;
    }
    if(bestPath && opts.flipPath) {
      // [src], -down->mid, -down->close, -right->dest
      // [dest], -left->close, -up->mid, -up->src
      const len = bestPath.length;
      const out = new Array(len);
      bestPath.reverse().forEach((step, idx) => {
        out[idx] = {exit: (step.exit + 4) % 8};
        if(idx > 0) out[idx-1].room = step.room;
      });
      out[len-1].room = srcRoom;
      bestPath = out;
    }
    return [goal, bestPath];
},
exitPath: function(fullPath) {
  const path = fullPath.path;
  return path.filter(pos => pos.x == 0 || pos.x == 49 || pos.y == 0 || pos.y == 49).concat(path[path.length-1]);
},
setMem: function(mem, spawnRoom, destRoom, opts={}) {
    const path = macroPath(spawnRoom, destRoom, opts.badRooms, opts.badCost);
    if(!path) {
      console.log(`Unable to find remote path from ${spawnRoom} to ${destRoom}`);
      return ERR_NO_PATH;
    }
    mem.roomPath = path;
    return mem;
},
travelCost,
longPath,
};
