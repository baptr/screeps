const roads = require('plan.roads');
const reserver = require('role2.reserver');
const harvester = require('role2.dropHarvester')
const relocater = require('role.relocater');
const builder = require('role2.builder');
const hauler = require('role2.hauler');
const local = require('local');
const resUtil = require('util.resources');

const SPAWN = local.homeSpawn;
const destRoom = ((SPAWN || {}).room || {}).name;

module.exports = {
build: function(roomName, spawn=SPAWN) {
    var mem = {};
    relocater.setMem(mem, roomName, builder.ROLE);
    const body = builder.mkBody(spawn.room.energyAvailable);
    const name = `${builder.ROLE}-${roomName}-${Game.time}`;
    return spawn.spawnCreep(body, name, {memory: mem});
},
roads: function(roomName, spawn=SPAWN) {
    // XXX calculate this stuff.
    /*
    const spawnPos = spawn.pos;
    const store = spawn.room.storage.pos;
    
    const resCtrl = new RoomPosition(7, 14, destRoom);
    roads.plan(spawnPos, resCtrl);
    
    const srcOne = new RoomPosition(28, 39, destRoom);
    roads.plan(spawnPos, srcOne);
    roads.plan(srcOne, store);
    
    const srcTwo = new RoomPosition(42, 40, destRoom);
    roads.plan(spawnPos, srcTwo);
    */
},
run: function(roomName) {
    // it's a bit tricky to count what's still spawning or headed to the room
    // so assume this is only run every 500 ticks or so...
    // if(Game.time % 500 != 0) return false;
    
    const spawns = _.filter(Game.spawns, s => {return !s.spawning && s.room.energyAvailable > 600});
    if(spawns.length == 0) return ERR_BUSY;
    
    const room = Game.rooms[roomName];
    if(room) {
        // XXX Look for all creeps *assigned* to the room, not just the ones in it.
        const kinds = _.groupBy(room.find(FIND_MY_CREEPS).filter(c => {
            if(c.memory.role == reserver.ROLE) return c.ticksToLive > 100;
            return c.ticksToLive > 600;
        }), c => c.memory.role);
        const numRole = role => (kinds[role] || []).length;
        console.log(`remoteHarvest ${roomName} state:`, JSON.stringify(_.mapValues(kinds, (v, k) => numRole(k))));

        const hauls = hauler.assigned(roomName);
        const dist = Game.map.findRoute(destRoom, roomName).length;
        console.log(`remoteHarvest(${roomName}) has ${hauls.length} haulers to go ${dist} away`);
        if(hauls.length < dist*2 && hauls.length * 500 < resUtil.roomResource(room)) {
            const spawn = spawns.shift();
            const ret = hauler.spawnRemote(spawn, roomName, destRoom);
            console.log(`${spawn} spawning more haulers: ${ret}`);
            if(ret != OK) spawns.push(spawn);
            if(spawns.length == 0) return ret;
        }

        // TODO: Calculate whether we'll drain the unreserved source fast
        // enough to warrant this.
        /*
        const ctrl = room.controller;
        const rsvs = reserver.assigned(roomName).filter(c => c.ticksToLive > 100);
        if(!rsvs.length && (!ctrl.reservation || ctrl.reservation.ticksToEnd < 100)) {
            const spawn = spawns.shift();
            const ret = reserver.spawn(spawn, roomName);
            // XXX Debugging how I ended up with 3 reservers.
            console.log(`${spawn} spawning more reservers (had ${rsvs}, ${JSON.stringify(ctrl.reservation)}): ${ret}`);
            if(ret != OK) spawns.push(spawn);
            if(spawns.length == 0) return ret;
        }
        */

        // TODO: don't necessarily need a harvester yet if road workers are keeping the sources empty..
        // TODO: or even to spawn more (yet) if there's already a backlog of energy around...
        const hvsts = harvester.assigned(roomName).filter(c => c.ticksToLive > 100);
        if(hvsts.length < room.find(FIND_SOURCES).length) {
            const spawn = spawns.shift();
            const ret = harvester.spawnRemote(spawn, roomName);
            console.log(`${spawn} spawning more harvesters: ${ret}`);
            if(ret != OK) spawns.push(spawn);
            if(spawns.length == 0) return ret;
        }


        /*
        // TODO: See if there's enough to build/repair for this to be useful.
        if(numRole(builder.ROLE) < 1) {
            let spawn = spawns.shift();
            let ret = module.exports.build(roomName, spawn);
            console.log(`${spawn} spawning more builders: ${ret}`);
            if(ret != OK) spawns.push(spawn);
            if(spawns.length == 0) return;
        }
        */
    } else {
      if(!harvester.assigned(roomName).length) {
        return harvester.spawnRemote(SPAWN, roomName);
      } else {
        console.log("Waiting for remoteHarvester to arrive in " + roomName);
      }
    }
}
};
