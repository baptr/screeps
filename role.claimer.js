const roleUpgrader = require('role.upgrader');
const roleBootstrapper = require('role2.bootstrapper');
const BodyBuilder = require('util.bodybuilder');
const util = require('util.creep');
const pathUtil = require('util.pathing');
const local = require('local');

function sack(creep) {
    spawn = creep.pos.findClosestByPath(FIND_MY_SPAWNS);
    if(!spawn) {
        pos = creep.pos.findClosestByPath(FIND_MY_CONSTRUCTION_SITES, {
            filter: {structureType: STRUCTURE_SPAWN}
        });
        if(pos) creep.moveTo(pos);
        return;
    }
    if(creep.pos.isNearTo(spawn)) {
        spawn.recycleCreep(creep);
    } else {
        creep.moveTo(spawn);
    }
}

const ROLE = 'claimer'
module.exports = {
    ROLE,
    needed: function(room) {
        if(room.controller && room.controller.my) return false;
        return !_.find(Memory.creeps, c => c.role == ROLE && c.targetRoom == room.name)

    },
    spawn: function(spawn, room, destPos=null) {
      if(spawn.spawning) return ERR_BUSY;
        
      const body = new BodyBuilder([MOVE, MOVE, MOVE, MOVE, MOVE, CLAIM], spawn.room.energyAvailable);
      //body.extend([MOVE, MOVE, CARRY, WORK], limit=3);
      // TODO(baptr): Add some tough if they go through hostile rooms.

      if(!body.valid()) return ERR_NOT_ENOUGH_ENERGY;
        
      const macroPath = pathUtil.macroPath(spawn.pos.roomName, room);
      if(!macroPath) {
        console.log(`Unable to spawn claimer for room ${room}, no macro path to goal`);
        return ERR_NO_PATH;
      }

      // TODO: decide whether it's worth serializing and using the full path
      /*
      const macroRooms = macroPath.map(e => e.room).concat([spawn.pos.roomName]);
      if(!destPos) destPos = new RoomPosition(25, 25, room);
      const path = PathFinder.search(spawn.pos, destPos, {
        maxOps: 10000,
        roomCallback: name => macroRooms.includes(name) ? pathUtil.roomCallback : false});
      if(path.incomplete) {
        console.log(`Unable to spawn claimer for room ${room}, no low level path to goal`);
        return ERR_NO_PATH;
      }

      // TODO: Probably need custom de/serialization to do this across rooms.
      const sPath = Room.serializePath(path.path.map((s, idx, path) => ({
        x: s.x, y: s.y, direction: s.getDirectionTo(path[idx+1])
      })).slice(0, -1));
      */

      const mem = {role: ROLE, targetRoom: room, roomPath: macroPath};

      return spawn.spawnCreep(body.sort(), `${ROLE}-${room}`, {memory: mem});
    },
    run: function(creep) {
      // It can happen that the path to the controller ends up leaving the room.
      // Without remembering the controller position, the creep might go right
      // back in to spot it again, and get stuck on the border.
      const targetRoom = creep.memory.targetRoom;

      if(creep.memory.roomPath) {
        return pathUtil.macroMove(creep)
      }

      var room = Game.rooms[targetRoom];
      if(room) {
        var ctrl = room.controller;
        if(ctrl.my) return sack(creep);
        if(!creep.pos.isNearTo(ctrl)) {
          return creep.moveTo(ctrl);
        }
        var ret = creep.claimController(ctrl);
        switch(ret) {
          case ERR_GCL_NOT_ENOUGH:
            if(Game.time % 20 == 0) console.log(`Too soon to claim ${targetRoom}`);
            break;
          case OK:
            console.log(`Welcome to ${targetRoom}!!`);
            if(creep.getActiveBodyparts(WORK) > 0) { 
              creep.memory.role = roleBootstrapper.ROLE;
            }
            break;
          default:
            console.log(`Unrecognized claim(${targetRoom}) ret: ${ret}`);
            return ret;
        }
      } else {
        return creep.moveTo(new RoomPosition(25, 25, targetRoom));
      }
    }
};
