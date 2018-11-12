// TODO figure this out/parameterize it.
const SPAWN = Game.spawns.SpawnE15N28;

module.exports = {
reserve: function(roomName) {
    return require('role2.reserver').spawn(SPAWN, roomName);
},
harvest: function(roomName) {
    return require('role2.dropHarvester').spawnRemote(SPAWN, roomName);
},
build: function(roomName) {
    const relocater = require('role.relocater');
    const builder = require('role2.builder');
    var mem = {};
    relocater.setMem(mem, roomName, builder.ROLE);
    const body = builder.mkBody(SPAWN.room.energyAvailable);
    const name = `${builder.ROLE}-${roomName}-${Game.time}`;
    return SPAWN.spawnCreep(body, name, {memory: mem});
},
haul: function(roomName) {
    return require('role2.hauler').spawnRemote(SPAWN, roomName);
},
roads: function(roomName) {
    // XXX calculate this stuff.
    const roads = require('plan.roads');
    const spawn = SPAWN.pos;
    const store = SPAWN.room.storage.pos;
    
    /*
    const resCtrl = new RoomPosition(7, 14, 'E14N27');
    roads.plan(spawn, resCtrl);
    */
    
    const srcOne = new RoomPosition(28, 39, 'E14N27');
    roads.plan(spawn, srcOne);
    roads.plan(srcOne, store);
    
    const srcTwo = new RoomPosition(42, 40, 'E14N27');
    roads.plan(spawn, srcTwo);
}
};