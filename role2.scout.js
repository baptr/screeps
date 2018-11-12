const util = require('util.creep');

const ROLE = 'scout';
const BODY = [TOUGH, MOVE, TOUGH, MOVE];
const BODY_COST = util.bodyCost(BODY);

module.exports = {
ROLE,
exists: function(room) {
    var found = false;
    _.forEach(Memory.creeps, c => {
        if(c.role == ROLE && c.target == room) {
            found = true;
            return false;
        }
    });
    return found;
},
spawn: function(targetRoom) {
    const name = `${ROLE}-${targetRoom}-${Game.time}`;
    
    // find an idle spawner as near the room as possible..
    var minPath = Number.POSITIVE_INFINITY;
    var spawn;
    _.forEach(Game.rooms, r => {
        if(!r.controller || !r.controller.my) return;
        if(r.energyAvailable < BODY_COST) return;
        
        let spawns = r.find(FIND_MY_SPAWNS, s => !s.spawning);
        if(!spawns.length) return;
        
        let path = Game.map.findRoute(r, targetRoom);
        if(path == ERR_NO_PATH) return;
        if(path.length >= minPath) return;
        minPath = path.length;
        
        // TODO(baptr): Pick the closer spawn to the exit?
        spawn = spawns[0];
    });
    if(!spawn) return ERR_NO_PATH;
    console.log(`Spawning ${name} from ${spawn}`);
    return spawn.spawnCreep([TOUGH, MOVE, TOUGH, MOVE], name, {
        memory: {
            target: targetRoom,
            role: ROLE
        }
    });
},
run: function(creep) {
    const target = creep.memory.target;
    if(!target) {
        console.log(`${creep.name} has nothing to do, good day!`);
        creep.suicide();
    }
    creep.moveTo(new RoomPosition(25, 25, target), {visualizePathStyle: {}, reusePath: 100});
}
};