const recycle = require('role2.recycle');

function bodyCost(body) {
    return _.sum(body, p => BODYPART_COST[p.type || p]);
}

module.exports = {
bodyCost,
creepReport: function(roomName) {
    const room = Game.rooms[roomName];
    if(!room) {
        console.log(`No visibility into ${roomName}`);
        return false;
    }
    var creeps = room.find(FIND_CREEPS);
    console.log(`${roomName} has ${creeps.length} total creeps`);
    var kinds = _.groupBy(creeps, c => c.memory.role);
    _.forEach(kinds, (v, k) => {
        console.log(`${k}: ${v.length}`);
    });
},
recycle: function(creep) {
    return recycle.convert(creep);
},
respawn: function(creep, start=100, stop=600) {
    // It's generally slightly more expensive to renew a creep than spawn it
    // fresh
    if(creep.ticksToLive < start && !creep.memory.respawn) {
        var spawns = creep.room.find(FIND_MY_SPAWNS);
        _.forEach(spawns, s => {
            if(s.spawning) return;
            if(creep.pos.inRangeTo(s, 10)) {
                console.log(`${creep.name} trying to renew`);
                creep.memory.respawn = s.id;
                return false;
            }
        });
    }
    if(creep.memory.respawn) {
        if(creep.ticksToLive > stop) {
            delete creep.memory.respawn;
        }
        var spawn = creep.pos.findClosestByPath(FIND_MY_SPAWNS);
        if(spawn) {
            creep.moveTo(spawn);
            let ret = spawn.renewCreep(creep);
            switch(ret) {
            case ERR_NOT_IN_RANGE:
                break;
            case ERR_NOT_ENOUGH_ENERGY:
                // TODO no guarantee this won't get stuck in a loop.
                console.log('Not enough energy to renew :(');
                delete creep.memory.respawn;
                break;
            case ERR_BUSY:
                if(creep.ticksToLive > start) delete creep.memory.respawn;
                break;
            case OK:
                const body_size = creep.body.length;
                const cost = Math.ceil(bodyCost(creep.body)/2.5/body_size)
                creep.memory.cost += cost;
                if(Game.time % 20 == 0) console.log(`${creep.name} renewed +${Math.floor(600/body_size)} ticks for ${cost}`);
                break;
            default:
                console.log(`${creep.name} failed to renew: ${ret}`);
                break;
            }
            return true;
        }
    }
    return false;
}
};
