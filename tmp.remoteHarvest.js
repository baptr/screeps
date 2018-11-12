const roads = require('plan.roads');
const reserver = require('role2.reserver');
const harvester = require('role2.dropHarvester')
const relocater = require('role.relocater');
const builder = require('role2.builder');
const hauler = require('role2.hauler');

const destRoom = 'E14N28';
const SPAWN = Game.spawns.SpawnE14N28;

module.exports = {
reserve: function(roomName, spawn=SPAWN) {
    return reserver.spawn(spawn, roomName);
},
harvest: function(roomName, spawn=SPAWN) {
    return harvester.spawnRemote(spawn, roomName);
},
build: function(roomName, spawn=SPAWN) {
    var mem = {};
    relocater.setMem(mem, roomName, builder.ROLE);
    const body = builder.mkBody(spawn.room.energyAvailable);
    const name = `${builder.ROLE}-${roomName}-${Game.time}`;
    return spawn.spawnCreep(body, name, {memory: mem});
},
haul: function(roomName, spawn=SPAWN) {
    return hauler.spawnRemote(spawn, roomName, destRoom);
},
roads: function(roomName, spawn=SPAWN) {
    // XXX calculate this stuff.
    const spawnPos = spawn.pos;
    const store = spawn.room.storage.pos;
    
    /*
    const resCtrl = new RoomPosition(7, 14, 'E14N27');
    roads.plan(spawnPos, resCtrl);
    */
    
    const srcOne = new RoomPosition(28, 39, 'E14N27');
    roads.plan(spawnPos, srcOne);
    roads.plan(srcOne, store);
    
    const srcTwo = new RoomPosition(42, 40, 'E14N27');
    roads.plan(spawnPos, srcTwo);
},
run: function(roomName) {
    // it's a bit tricky to count what's still spawning or headed to the room
    // so assume this is only run every 500 ticks or so...
    // if(Game.time % 500 != 0) return false;
    
    var spawns = _.filter(Game.spawns, s => {return !s.spawning && s.room.energyAvailable > 1000});
    
    const room = Game.rooms[roomName];
    if(room) {
        const kinds = _.groupBy(room.find(FIND_MY_CREEPS).filter(c => c.ticksToLive > 500), c => c.memory.role);
        const numRole = role => (kinds[role] || []).length;
        console.log(`remoteHarvest ${roomName} state:`, JSON.stringify(_.mapValues(kinds, (v, k) => numRole(k))));
        // would be nice to send (especially) harvesters in before the old ones expire.
        if(numRole(harvester.ROLE) < 2) {
            console.log('spawning more harvesters');
            module.exports.harvest(roomName, spawns.shift());
        }
        if(numRole(reserver.ROLE) < 1) {
            console.log('spawning more reservers');
            module.exports.reserve(roomName, spawns.shift());
        }
        if(numRole(hauler.ROLE) < 2) {
            console.log('spawning more haulers');
            module.exports.haul(roomName, spawns.shift());
        }
        if(numRole(builder.ROLE) < 1) {
            console.log('spawning more builders');
            module.exports.build(roomName, spawns.shift());
        }
    } else {
        module.exports.reserve(roomName);
    }
}
};