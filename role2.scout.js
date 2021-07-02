const util = require('util.creep');

const ROLE = 'scout';
const BODY = [MOVE, MOVE, MOVE, MOVE];
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
    let bestPath;
    var spawn;
    _.forEach(Game.rooms, r => {
        if(!r.controller || !r.controller.my) return;
        if(r.energyAvailable < BODY_COST) return;
        
        let spawns = r.find(FIND_MY_SPAWNS, {filter: s => !s.spawning});
        if(!spawns.length) return;
        
        let path = Game.map.findRoute(r, targetRoom);
        if(path == ERR_NO_PATH) return;
        if(path.length >= minPath) return;
        minPath = path.length;
        bestPath = path;
        
        // TODO(baptr): Pick the closer spawn to the exit?
        spawn = spawns[0];
    });
    if(!spawn) return ERR_NO_PATH;
    const ret = spawn.spawnCreep(BODY, name, {
        memory: {
            target: targetRoom,
            roomPath: bestPath,
            role: ROLE
        }
    });
    if(ret == OK) console.log(`Spawning ${name} from ${spawn}`);
    return ret;
},
run: function(creep) {
    const target = creep.memory.target;
    if(!target) {
        console.log(`${creep.name} has nothing to do, good day!`);
        creep.suicide();
    }
    if(creep.memory.roomPath) {
        let hop = creep.memory.roomPath[0];
        if(creep.room.name == hop.room) {
            creep.memory.roomPath.shift();
            hop = creep.memory.roomPath[0];
            if(!hop) {
                delete creep.memory.roomPath;
            }
        }
        if(hop) {
            const exit = creep.pos.findClosestByPath(hop.exit);
            // TODO: Handle it being cheaper to leave the room and come back through a different entrance.
            const ret = creep.moveTo(exit, {visualizePathStyle: {}, reusePath: 100, maxRooms: 1});
            // console.log(`scout ${creep.name} heading from ${creep.pos.roomName} to ${hop.room} via exit ${hop.exit} @ ${JSON.stringify(exit)}. ret=${ret}`);
            return ret;
        }
    }
    creep.moveTo(new RoomPosition(25, 25, target), {visualizePathStyle: {}, reusePath: 100});
}
};
