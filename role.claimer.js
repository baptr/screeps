var roleUpgrader = require('role.upgrader');
var util = require('util.creep');

module.exports = {
    spawn: function(spawn, room) {
        if(spawn.room.findExitTo(room) < 0) {
            console.log(`Unable to spawn claimer for room ${room}, no exit`);
            return false;
        }

        var body = [CLAIM, MOVE];
        var curCost = util.bodyCost(body);
        
        const extraCost = util.bodyCost([MOVE, MOVE, CARRY, WORK]);
        var workCount = 0;
        while(spawn.room.energyAvailable > curCost+extraCost && workCount < 3) {
            body.push(MOVE, MOVE, CARRY, WORK);
            curCost += extraCost;
            workCount++;
        }
        // TODO(baptr): These don't always need to be so tough...
        /*const toughCost = util.bodyCost([MOVE, TOUGH]);
        while(spawn.room.energyAvailable > curCost+toughCost && body.length+2 <= MAX_CREEP_SIZE) {
            body.push(MOVE, TOUGH);
            curCost += toughCost;
        }*/
        
        // Reasonable proxy for getting tough first and claim last.
        body.sort((a,b) => BODYPART_COST[a] - BODYPART_COST[b]);
        
        var mem = {role: 'claimer', targetRoom: room};
        
        return spawn.spawnCreep(body, 'claimer_'+room, {memory: mem});
    },
    run: function(creep) {
        var targetRoom = creep.memory.targetRoom;
        if(creep.room.name != targetRoom) {
            var dir = creep.room.findExitTo(targetRoom);
            var exit = creep.pos.findClosestByPath(dir);
            creep.moveTo(exit);
        } else {
            var ctrl = creep.room.controller;
            if(ctrl.my) {
                return roleUpgrader.run(creep);
            } else {
                var ret = creep.claimController(ctrl);
                switch(ret) {
                case ERR_NOT_IN_RANGE:
                    creep.moveTo(ctrl);
                    break;
                case ERR_GCL_NOT_ENOUGH:
                    if(Game.time % 20 == 0) console.log(`Too soon to claim ${targetRoom}`);
                    break;
                case OK:
                    console.log(`Welcome to ${targetRoom}!!`);
                    break;
                default:
                    console.log(`Unrecognized claim(${targetRoom}) ret: ${ret}`);
                }
            }
        }
    }
};