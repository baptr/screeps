var roleHarvester = require('role.harvester');
var remoteHarvester = require('role.remoteHarvester');
var roleUpgrader = require('role.upgrader');
var roleBuilder = require('role.builder');
var roleRepairer = require('role.repairer');
var roleDefender = require('role.defender');
var roleTower = require('role.tower');

var BASE_NAME = 'W4N9';
console.log('Reloading');

function addMOVE(body) {
    // TODO(baptr): Filter for only non-MOVE parts.
    return body.concat(Array(body.length).fill(MOVE));
}

var colonyTargets = [
    // TODO(baptr): Bootstrap fallback
    {role: "harvester", body: addMOVE([WORK, CARRY]), target: 1,
        memory: {source: "e1620773914ad5a"}},
    // remote W1C4 = 1750
    {role: "remoteHarvester", subtype: "_W5N9", body: addMOVE([WORK, WORK, CARRY, CARRY, CARRY, CARRY]), target: 2, 
        memory: remoteHarvester.new("W5N9", 'f43107732c09317')},
    {role: "harvester", subtype: "_big", body: addMOVE([WORK, WORK, WORK, CARRY, CARRY, CARRY]), target: 2,
        memory: {source: "e1620773914ad5a"}},
    {role: "upgrader", body: [WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE], target: 2,
        memory: {source: "e218077391460aa"}},
    {role: "builder", body: addMOVE([WORK, WORK, CARRY, CARRY, CARRY, CARRY]), target: 3,
        memory: {container: "5b3e8add5676c340a95d3ac1"}},
];
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

_.forEach(colonyTargets, t => {
    var cost = bodyCost(t.body);
    var id = "role " + t.role;
    if(t.subtype) { id += t.subtype }
    console.log(id + " costs " + cost);
});

module.exports.loop = function () {
    var room = Game.rooms[BASE_NAME];
    // Periodic cleanup
    if(room.energyAvailable >= buildThreshold && Game.time % 20 == 0) {
        var lost = [];
        for(var name in Memory.creeps) {
            if(!Game.creeps[name]) {
                lost.push(name);
                delete Memory.creeps[name];
            }
        }
        if(lost.length) { console.log('Lost: '+lost); }
        
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
            if(targets.length < kind.target) {
                var id = kind.role;
                if(kind.subtype) { id += kind.subtype }
                var newName = id + '_' + Game.time;
                var mem = kind.memory || {};
                mem.role = kind.role;
                mem.subtype = kind.subtype;
                var cost = bodyCost(kind.body);
                if(cost > room.energyAvailable) {
                    buildingSay(spawn, room.energyAvailable+'<'+cost);
                    //console.log("Cost to spawn "+newName+" with body: "+kind.body+" is "+cost+" > "+room.energyAvailable);
                    return false; // Might be able to spawn something less important, but we should save up.
                }
                var ret = spawn.spawnCreep(kind.body, newName, {memory: mem});
                buildingSay(spawn, targets.length+'/'+kind.target+' '+id);
                //console.log('Only '+targets.length+' '+id+', spawning up to '+kind.target+': '+ret);
                return false;
            }
        })
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