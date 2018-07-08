var roleHarvester = require('role.harvester');
var remoteHarvester = require('role.remoteHarvester');
var roleUpgrader = require('role.upgrader');
var roleBuilder = require('role.builder');
var roleRepairer = require('role.repairer');
var roleDefender = require('role.defender');
var roleClaimer = require('role.claimer');
var roleRelocater = require('role.relocater');
var roleMiner = require('role.miner');
var roleTransfer = require('role.linkTransfer');

var roleTower = require('role.tower');

const SPAWN_NAME = 'Spawn1';
const BASE_NAME = Game.spawns[SPAWN_NAME].room.name; // 'W4N9';
const DUMP_COSTS = false;
console.log('Reloading');

function addMOVE(body) {
    // TODO(baptr): Filter for only non-MOVE parts.
    return body.concat(Array(body.length).fill(MOVE));
}

var colonyTargets = [
    // TODO(baptr): Auto-downscale these for initial setup.
    {role: "harvester", body: addMOVE([WORK, CARRY]), target: 1, memory: {source: "e1620773914ad5a"}},
    {role: "remoteHarvester", subtype: "_W5N9", body: addMOVE([WORK, WORK, CARRY, CARRY, CARRY, CARRY]), target: 2, 
        memory: remoteHarvester.new("W5N9", 'f43107732c09317')},
    {role: "harvester", subtype: "_big", body: addMOVE([WORK, WORK, WORK, CARRY, CARRY, CARRY]), target: 2,
        memory: {source: "e1620773914ad5a"}},
    {role: "upgrader", body: [WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE], target: 2,
        memory: {source: "e218077391460aa"}},
    {role: "builder", body: addMOVE([WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY]), target: 2,
        memory: {container: "5b3e8add5676c340a95d3ac1"}},
    {role: "miner", body: addMOVE([WORK, WORK, WORK, WORK, CARRY]), target: 1,
        memory: {source: "7ec06164d63658d", store: "5b408f605676c340a95e55b6"},
        condition: roleMiner.spawnCondition,
    },
    {role: "linkTransfer", dynSpawn: function(spawn) { 
        roleTransfer.spawn(spawn, Game.getObjectById(roleTransfer.pocketSrc), Game.getObjectById(roleTransfer.controllerLink));
    }, condition: function(room) { 
        return !_.some(Game.creeps, (c) => c.my && c.memory.reloNextRole == 'linkTransfer');
    }, target: 1},
];
var remoteUpgraderBody = Array(6).fill(WORK).concat(Array(6).fill(CARRY), Array(12).fill(MOVE));
var buildThreshold = 250; // TODO(baptr): calculate

function bodyCost(body) {
    return _.sum(_.map(body, e => BODYPART_COST[e]));
}

function buildingSay(struct, text) {
    struct.room.visual.text(
        text,
        struct.pos.x + 1, 
        struct.pos.y, 
        {align: 'left', opacity: 0.8});
}

if(DUMP_COSTS) {
    _.forEach(colonyTargets, t => {
        var cost = bodyCost(t.body);
        var id = "role " + t.role;
        if(t.subtype) { id += t.subtype }
        console.log(id + " costs " + cost);
    });
}

module.exports.loop = function () {
    var room = Game.rooms[BASE_NAME];
    // Periodic cleanup
    if(room.energyAvailable >= buildThreshold && Game.time % 20 == 0) {
        var lost = [];
        for(var name in Memory.creeps) {
            if(!Game.creeps[name]) {
                var plaque = name;
                var achievement = Memory.creeps[name].delivered;
                if(achievement) {
                    plaque += ' (delivered '+achievement+')';
                }
                lost.push(plaque)
                delete Memory.creeps[name];
            }
        }
        if(lost.length) { console.log('Lost '+lost); }
        
        // Spawn checks...
        var spawn = Game.spawns['Spawn1'];
        
        // TODO(baptr): Can this wait 20 ticks?
        if(room.find(FIND_HOSTILE_CREEPS).length) {
            console.log("We're under attack!!");
            buildingSay(spawn, "Oh snap");
            roleDefender.spawn(spawn, {});
        }
        
        var kinds = _.groupBy(Game.creeps, creep => creep.memory.role+creep.memory.subtype);
        _.forEach(colonyTargets, kind => {
            var targets = kinds[kind.role+kind.subtype] || [];
            if(targets.length >= kind.target) {
                return;
            }
            if(kind.condition && !kind.condition(room)) {
                return;
            }
            if(kind.dynSpawn) {
                kind.dynSpawn(spawn);
                return false;
            }
            var id = kind.role;
            if(kind.subtype) { id += kind.subtype }
            var newName = id + '_' + Game.time;
            var mem = kind.memory || {};
            mem.role = kind.role;
            mem.subtype = kind.subtype;
            var cost = bodyCost(kind.body);
            if(cost > room.energyAvailable) {
                buildingSay(spawn, room.energyAvailable+'<'+cost);
                return false; // Might be able to spawn something less important, but we should save up.
            }
            var ret = spawn.spawnCreep(kind.body, newName, {memory: mem});
            buildingSay(spawn, targets.length+'/'+kind.target+' '+id);
            return false;
        })
        
        // TODO(baptr): Work this in to the normal hash.
        if(room.energyAvailable > bodyCost(remoteUpgraderBody) && (kinds['upgrader_W5N9'] || []).length < 2) {
            spawn.spawnCreep(remoteUpgraderBody, 'remoteUpgrader_W5N9_'+Game.time, {memory: 
                {role: 'relocater', subtype: '_W5N9', reloRoom: 'W5N9', reloNextRole: 'upgrader',
                    container: '5b4120c35676c340a95ea8f9'
                }})
        }
    }
    
    if(Game.spawns['Spawn1'].spawning) { 
        var spawningCreep = Game.creeps[Game.spawns['Spawn1'].spawning.name];
        buildingSay(Game.spawns['Spawn1'], '🛠️' + spawningCreep.memory.role);
    }
    
    for(var name in Game.creeps) {
        var creep = Game.creeps[name];
        switch(creep.memory.role) {
        case 'harvester':
            if(roleHarvester.run(creep) === false) {
                roleRepairer.run(creep);
            }
            break;
        case 'upgrader':
            roleUpgrader.run(creep);
            break;
        case 'builder':
            if(roleBuilder.run(creep) === false) {
                if(roleRepairer.run(creep) === false) {
                    roleHarvester.run(creep);
                };
            };
            break;
        case 'remoteHarvester':
            remoteHarvester.run(creep);
            break;
        case 'defender':
            roleDefender.run(creep);
            break;
        case 'claimer':
            roleClaimer.run(creep);
            break;
        case 'relocater':
            roleRelocater.run(creep);
            break;
        case 'miner':
            if(roleMiner.run(creep) === false) {
                roleRepairer.run(creep);
            }
            break;
        case 'linkTransfer':
            roleTransfer.run(creep);
            break;
        default:
            console.log(name + " has no known role ("+creep.memory.role+")");
        }
    }
    
    for(var name in Game.structures) {
        var struct = Game.structures[name];
        if(struct.structureType != 'tower') { continue; }
        roleTower.run(struct);
    }
}