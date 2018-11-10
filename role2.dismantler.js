const ROLE = 'dismantler';

function planBody() {
    // TODO(baptr): Make this work with the part consts.
    const bodySpec = {
        work: 15,
        move: 25,
        heal: 3,
        tough: 7,
    };
    var body = [];
    _.forEach(bodySpec, (c, t) => {
        body.push(...Array(c).fill(t));
    })
    const bodyPriority = {
        tough: 1,
        move: 2,
        heal: 3,
        carry: 4,
        work: 5,
    };
    body.sort((a, b) => bodyPriority[a] - bodyPriority[b]);
    return body;
}

function findTarget(target, creep) {
    var wall = creep.pos.findClosestByPath(FIND_STRUCTURES, {filter: {structureType: STRUCTURE_WALL}});
    if(wall) {
        return wall;
    } 
    
    var friend = creep.pos.findClosestByPath(FIND_MY_CREEPS, {filter: c => c.hits < c.hitsMax});
    if(friend) {
        return friend;
    }
    
    var ramp = creep.pos.findClosestByPath(FIND_STRUCTURES, {filter: {structureType: STRUCTURE_RAMPART}});
    if(ramp) {
        return ramp;
    }
}

module.exports = {
ROLE: ROLE,
planBody: planBody,
spawn: function(spawn, target) {
    if(!target) {
        console.log("No reason to spawn dismantler with no target for now");
        return ERR_INVALID_TARGET; // :-D
    }
    const body = planBody(spawn);
    
    return spawn.spawnCreep(body, `${ROLE}-${spawn.name}-${Game.time}`, {memory: {
        role: ROLE,
        target: target,
    }});
},
run: function(creep) {
    if(creep.hits < creep.hitsMax && creep.getActiveBodyparts(HEAL)) {
        creep.heal(creep);
    }
    
    var target = Game.getObjectById(creep.memory.target);
    if(!target) {
        target = findTarget(creep, creep);
        if(!target) {
            if(Game.time % 20 == 0) console.log("No target remaining for", creep.name);
            return;
        }
        creep.memory.target = target.id;
        creep.memory.blocked = 0;
    }
    if(target instanceof Creep) {
        if(target.my && target.hits < target.hitsMax) {
            creep.moveTo(target);
            creep.heal(target);
            return
        } else {
            delete creep.memory.target;
        }
    } else {
        // TOOD(baptr): Could be less expensive.
        var friend = creep.pos.findInRange(FIND_MY_CREEPS, 3, {filter: c => c.hits < c.hitsMax});
        if(friend) creep.rangedHeal(friend);
    }
    if(creep.moveTo(target) == ERR_NO_PATH) {
        creep.memory.blocked++;
        if(creep.memory.blocked > 10) {
            delete creep.memory.target;
            return;
        }
    };
    creep.dismantle(target);
},
test: function(target = '5b6cf7799ea31d5ae1438a50') {
    var spawned = 0;
    _.forEach(Game.spawns, s => {
        if(module.exports.spawn(s, target) == OK) {
            spawned++;
        }
    });
    console.log("Spawned",spawned,ROLE);
}
};