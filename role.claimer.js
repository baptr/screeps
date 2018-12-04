const roleUpgrader = require('role.upgrader');
const roleBootstrapper = require('role2.bootstrapper');
const BodyBuilder = require('util.bodybuilder');
const util = require('util.creep');

const ROLE = 'claimer'
module.exports = {
    ROLE,
    spawn: function(spawn, room) {
        if(spawn.room.findExitTo(room) < 0) {
            console.log(`Unable to spawn claimer for room ${room}, no exit`);
            return false;
        }
        
        var builder = new BodyBuilder([CLAIM, MOVE], spawn.room.energyAvailable);
        builder.extend([MOVE, MOVE, CARRY, WORK], limit=3);
        // TODO(baptr): Add some tough if they go through hostile rooms.
        
        var mem = {role: ROLE, targetRoom: room};
        
        return spawn.spawnCreep(builder.sort(), `${ROLE}-${room}`, {memory: mem});
    },
    run: function(creep) {
        // It can happen that the path to the controller ends up leaving the room.
        // Without remembering the controller position, the creep might go right
        // back in to spot it again, and get stuck on the border.
        const targetRoom = creep.memory.targetRoom;
        
        var room = Game.rooms[targetRoom];
        if(room) {
            var ctrl = room.controller;
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
                creep.memory.role = roleBootstrapper.ROLE;
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