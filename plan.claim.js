const claimer = require('role.claimer');
const builder = require('role2.builder');
const relocater = require('role.relocater');
const bootstrapper = require('role2.bootstrapper');
const scout = require('role2.scout');
const pathUtil = require('util.pathing');

const VISUALIZE = true;
const BOOTSTRAP = true;

function run(claimFlag) {
    if(!claimFlag) return ERR_INVALID_ARGS;
    
    const curRooms = _.filter(Game.rooms, r => r.controller && r.controller.my);
    const claimable = Game.gcl.level > curRooms.length;
    
    const spawnPos = claimFlag.pos;
    const roomName = spawnPos.roomName;
    const room = Game.rooms[roomName];

    if(!claimable && !room) return ERR_GCL_NOT_ENOUGH;
    
    const obs = Game.getObjectById(module.exports.observer);
    if(obs) {
        var ret = obs.observeRoom(roomName);
        if(ret != OK) {
            console.log(`Unable to observe ${roomName} from ${obs}: ${ret}`);
        }
        if(!room) {
            // TODO(baptr): If this happens multiple times, the observer must be in
            // use elsewhere...
            console.log(`No visibility into claim target ${roomName}, trying next tick...`);
            return ERR_NOT_FOUND;
        }
    } else if(!room) {
        if(!scout.exists(roomName)) {
            return scout.spawn(roomName);
        }
        return ERR_NOT_OWNER;
    }
    
    const ctrl = room.controller;
    
    // Is it actually worth some effort to (re)use the path? Or just spawn a few
    // relocater->bootstrappers and be done with it?
    if(claimable && !ctrl.my) {
        var [spawn, path] = pickSpawn(ctrl.pos);
        if(!spawn) return path;

        if(claimer.needed(room)) {
            let claimerRet = claimer.spawn(spawn, roomName);
            if(claimerRet == OK) return OK;
            console.log(`Claim(${roomName}): spawn claimer: ${ret}`);
        }

        /*
        var baddies = room.find(FIND_HOSTILE_CREEPS);
        if(baddies.length) {
          const defender = require('role.defender');
        }
        */
        
        var structs = room.find(FIND_HOSTILE_STRUCTURES);
        if(structs.length) {
            const dismantler = require('role2.dismantler');
            if(!_.find(Memory.creeps, c => c.role == dismantler.ROLE)) {
                let ret = dismantler.spawn(spawn, structs[0].id);
                console.log('Sending in a cleanup crew!', ret);
                return ret;
            }
        }
    }
    if(!BOOTSTRAP) return;
    if(ctrl.my) {
        if(room.find(FIND_MY_SPAWNS).length || room.find(FIND_MY_CONSTRUCTION_SITES,
                {filter: {structureType: STRUCTURE_SPAWN}}).length) {
            // Already planned, just send in some bootstrappers to help out.
            
            if(room.energyCapacityAvailable > 500) {
                console.log("Initial bootstrapping of",roomName,"complete");
                claimFlag.remove();
                return OK;
            }
            
            // TODO(baptr): This doesn't keep sending bigger ones once the room
            // is able to build its own, which was kind of the point.
            if(room.find(FIND_MY_CREEPS).length > 3) return OK;

            // Ugly workaround for leaving time to spawn/travel, and help save
            // up for better bodies.
            let next = room.memory.nextSpawnAttempt || 0;
            if(Game.time < next) return OK;
            room.memory.nextSpawnAttempt = Game.time + 100;
            
            const [spawn, path] = pickSpawn(ctrl.pos, CREEP_LIFE_TIME - 600);
            if(!spawn) return path;
            
            var body = builder.mkBody(spawn.room.energyAvailable);
            if(!body) return;
            const name = `relo-bootstrap-${roomName}-${Game.time}`;
            var ret = spawn.spawnCreep(body, name, {
                memory: relocater.setMem({}, roomName, 'bootstrapper', spawn.room.name),
            });
            if(ret != OK) console.log(`Failed to spawn ${name}: ${ret}`);
            return ret;
        } else {
            if(room.find(FIND_HOSTILE_STRUCTURES, {filter: s => s.structureType == STRUCTURE_SPAWN}).length) {
                if(Game.time % 100 == 0) {
                    // TODO(baptr): Spawn a new dismantler?
                    console.log("Waiting for enemy spawn to be gone in ", room);
                }
                return OK; // prevent repeat claim attempts
            }
            // TODO figure out a place for it via roomPlanner?
            var ret = room.createConstructionSite(spawnPos.x, spawnPos.y, STRUCTURE_SPAWN, 'Spawn'+roomName);
            console.log(`Placing construction site at ${spawnPos} in ${roomName}: ${ret}`);
            return ret;
        }
    }
    return OK;
}

// Pick a src spawn in a high enough (?) level room that's as close as
// possible to the target.
// TODO(baptr): Consider Game.map.findRoute...
// - easier to filter enemy rooms
function pickSpawn(dstPos, maxCost = CREEP_CLAIM_LIFE_TIME - 10) {
    const macroRooms = {};
    const spawns = Object.values(Game.spawns).filter(s => s.isActive() && !s.spawning && s.room.energyCapacityAvailable >= 650);
    if(!spawns.length) {
      return [null, ERR_BUSY];
    }
    for(const s of spawns) {
      if(macroRooms[s.room.name]) continue;
      macroRooms[s.room.name] = true;
      const path = pathUtil.macroPath(s.room.name, dstPos.roomName);
      if(path == ERR_NO_PATH) continue;
      for(const step of path) {
        macroRooms[step.room] = true;
      }
    }
    const goals = spawns.map(s => ({pos: s.pos, range: 1}));
    const pathRes = PathFinder.search(dstPos, goals, {plainCost: 1, swampCost: 1, maxCost, maxOps: 20000,
      roomCallback: name => macroRooms[name] ? undefined : false});
    const path = pathRes.path;
    if(!path.length) {
      console.log(`plan.claim: no path: ${JSON.stringify(pathRes)}`);
      return [null, ERR_NO_PATH];
    }
    
    path.reverse();
    if(VISUALIZE) visPath(path);
    if(pathRes.incomplete) {
      console.log(`Claimer unable to path. Best match has cost=${pathRes.cost}, took ${pathRes.ops}`);
      return [null, ERR_NOT_IN_RANGE];
    }

    var spawn = path[0].findClosestByRange(FIND_MY_SPAWNS);
    if(!spawn) {
        console.log('No spawn near calculated path');
        return [null, ERR_NOT_FOUND];
    }
    return [spawn, pathRes];
}

function visPath(path) {
    var roomVis;
    var lastRoom;
    for(let i = 1; i < path.length; i++) {
        let prev = path[i-1];
        let cur = path[i];
        if(prev.roomName != cur.roomName) continue;
        if(cur.roomName != lastRoom) {
            lastRoom = cur.roomName;
            roomVis = new RoomVisual(cur.roomName);
        }
        roomVis.line(prev, cur);
    }
}

// TODOs:
// - figure out a better way to use observers

module.exports = {
observer: '5b51885c8610fd40ae72c7da',
run: run,
pickSpawn,
test: function() {
    const target = Game.flags.Claim;
    if(target) {
        const ret = run(target);
        if(ret != OK) {
          if(ret != ERR_NOT_OWNER && (Game.time%50) == 0) console.log(`Claim(${target.pos}) = ${ret}`);
        }
        return ret;
    } else {
      return ERR_NOT_FOUND;
    }
}
};
