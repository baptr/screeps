const local = require('local');
/* TODOs:
   - Treat planned roads as cheaper during multiple passes.
*/

function macroPath(srcRoom, dstRoom, badRooms=local.badRooms||[], badCost = Infinity) {
  return Game.map.findRoute(srcRoom, dstRoom, {
    routeCallback: name => {
      if(badRooms.includes(name)) return badCost;
      if(name.includes('0')) return 1;
      return 3; // maybe even higher in season since there are so many swamps
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
macroMove: function(creep, pathMem='roomPath') {
  const path = creep.memory[pathMem];
  if(!path) {
    console.log(`${creep.name} trying to macroMove with no memory[${pathMem}]`);
    return ERR_NO_PATH;
  }
  let hop = path[0];
  if(creep.room.name == hop.room) {
    path.shift();
    hop = path[0];
    if(!hop) delete creep.memory[pathMem];
  }
  if(hop) {
    const exit = creep.pos.findClosestByPath(hop.exit);
    // TODO: Handle it being cheaper to leave the room and come back through a
    // different entrance.
    return creep.moveTo(exit, {visualizePathStyle: {}, reusePath: 50, maxRooms: 1});
  }
  return creep.moveTo(25, 25, {maxRooms: 1});
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
setMem: function(mem, spawnRoom, destRoom, opts={}) {
    const path = macroPath(spawnRoom, destRoom, opts.badRooms, opts.badCost);
    if(!path) {
      console.log(`Unable to find remote path from ${spawnRoom} to ${destRoom}`);
      return ERR_NO_PATH;
    }
    mem.roomPath = path;
    return mem;
},
};
