const recycle = require('role2.recycle');

function bodyCost(body) {
    return _.sum(body, p => BODYPART_COST[p.type || p]);
}

function renewCost(creep) {
    return Math.ceil(bodyCost(creep.body)/2.5/creep.body.length);
}

module.exports = {
bodyCost,
renewCost,
hasBody: function(creep, type) {
    var body = _.groupBy(creep.body, 'type');
    return body[type];
},
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
renew: function(creep, start=100, stop=600) {
    // It's generally slightly more expensive to renew a creep than spawn it
    // fresh
    if(creep.ticksToLive < start && !creep.memory.renew) {
        var spawns = creep.room.find(FIND_MY_SPAWNS);
        _.forEach(spawns, s => {
            if(s.spawning) return;
            if(creep.pos.inRangeTo(s, 10)) {
                const cost = renewCost(creep);
                const benefit = Math.floor(600/creep.body.length);
                console.log(`${creep.name} trying to renew: +${benefit}t/${cost}e`);
                creep.memory.renew = s.id;
                return false;
            }
        });
    }
    if(creep.memory.renew) {
        if(creep.ticksToLive > stop) {
            delete creep.memory.renew;
        }
        var spawn = Game.getObjectById(creep.memory.renew);
        if(spawn) {
            let ret = spawn.renewCreep(creep);
            switch(ret) {
            case ERR_NOT_IN_RANGE:
                creep.moveTo(spawn);
                break;
            case ERR_NOT_ENOUGH_ENERGY:
                // TODO no guarantee this won't get stuck in a loop.
                console.log('Not enough energy to renew :(');
                delete creep.memory.renew;
                return false;
            case ERR_BUSY:
                if(creep.ticksToLive > start) delete creep.memory.renew;
                return false;
            case OK:
                creep.memory.cost += renewCost(creep);
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
