const pathUtil = require('util.pathing');

// dummy role that moves between rooms before switching to a new role
// example:
// Game.spawns.Spawn2.spawnCreep([WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE], 'relo-builder', {memory: relocator.setMem({}, 'W4N8', 'builder')})
module.exports = {
    setMem: function(mem, roomName, nextRole, srcRoom=null) {
      mem.role = 'relocater';
      mem.reloRoom = roomName;
      mem.reloNextRole = nextRole;
      if(srcRoom) {
        srcPos = Game.rooms[srcRoom].find(FIND_MY_SPAWNS)[0].pos;
        dstPos = new RoomPosition(25, 25, roomName);
        return pathUtil.setMem(mem, srcPos, dstPos);
      }
      return mem;
    },
    run: function(creep) {
      // Run any heal parts on the way.
      if(creep.body.some(b => b.hits && b.type == HEAL)) {
        if(creep.hits < creep.hitsMax) {
          creep.heal(creep);
        } else {
          const friend = creep.pos.findClosestByRange(FIND_MY_CREEPS, {filter: c => c.hits < c.hitsMax});
          if(friend)  {
            const range = creep.pos.getRangeTo(friend.pos);
            if(range <= 1) {
              creep.heal(friend);
            } else if(range <= 3) {
              creep.rangedHeal(friend);
            }
          }
        }
      }

        // XXX
        if(creep.memory.roomPath) return pathUtil.macroMove(creep);
        if(creep.memory.exitPath) return pathUtil.macroMove(creep);

        const tgt = creep.memory.reloRoom;
        if(!tgt) {
            console.log(`${creep.name} has invalid target room ${tgt}`);
            return;
        }
        
        if(creep.room.name == tgt) {
          creep.moveTo(25, 25); // XXX is there some risk this leaves the room before converting?
            var newRole = creep.memory.reloNextRole;
            creep.say('Now '+newRole)
            creep.memory.role = newRole;
            delete creep.memory.reloRoom;
            delete creep.memory.reloNextRole;
            delete creep.memory.reloExit;
            return;
        }

        if(creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
            const res = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {filter: {resourceType: RESOURCE_ENERGY}});
            if(res) {
              creep.say("Chasing resources...");
                creep.moveTo(res);
                let ret = creep.pickup(res);
                if(ret != ERR_FULL) return;
            }
        }

        creep.moveTo(new RoomPosition(25,25,tgt));
    }
};
