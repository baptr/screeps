var roleHarvester = require('role.harvester');
var roleUpgrader = require('role.upgrader');
var roleBuilder = require('role.builder');
var tower = require('role.tower');

var BASE_NAME = 'W4N9';
console.log('Reloading');

function addMOVE(body) {
    // TODO(baptr): Filter for only non-MOVE parts.
    return body.concat(Array(body.length).fill(MOVE));
}

var colonyTargets = [
    // TODO(baptr): Bootstrap fallback
    {role: "harvester", body: addMOVE([WORK, CARRY]), target: 1, memory: {source: "e1620773914ad5a"}},
    {role: "harvester", subtype: ".big", body: addMOVE([WORK, WORK, CARRY, CARRY]), target: 2, memory: {source: "e1620773914ad5a"}},
    {role: "upgrader", body: [WORK, WORK, WORK, CARRY, MOVE], target: 2, memory: {source: "e218077391460aa"}},
    {role: "builder", body: addMOVE([WORK, WORK, CARRY, CARRY]), target: 2},
];
var buildThreshold = 250; // TODO(baptr): calculate

function bodyCost(body) {
    return _.sum(_.map(body, e => BODYPART_COST[e]));
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
        for(var name in Memory.creeps) {
            if(!Game.creeps[name]) {
                delete Memory.creeps[name];
                console.log('Clearing non-existing creep memory:', name);
            }
        }

        var kinds = _.groupBy(Game.creeps, creep => creep.memory.role+creep.memory.subtype);
        _.forEach(colonyTargets, kind => {
            var targets = kinds[kind.role+kind.subtype] || [];
            if(targets.length < kind.target) {
                var id = kind.role;
                if(kind.subtype) { id += kind.subtype }
                var newName = id + Game.time;
                var mem = kind.memory || {};
                mem.role = kind.role;
                mem.subtype = kind.subtype;
                var cost = bodyCost(kind.body);
                if(cost > room.energyAvailable) {
                    console.log("Cost to spawn "+newName+" with body: "+kind.body+" is "+cost+" > "+room.energyAvailable);
                }
                var ret = Game.spawns['Spawn1'].spawnCreep(kind.body, newName, {memory: mem})
                console.log('Only '+targets.length+' '+id+', spawning up to '+kind.target+': '+ret)
                return false
            }
        })
    }
    
    if(Game.spawns['Spawn1'].spawning) { 
        var spawningCreep = Game.creeps[Game.spawns['Spawn1'].spawning.name];
        Game.spawns['Spawn1'].room.visual.text(
            '🛠️' + spawningCreep.memory.role,
            Game.spawns['Spawn1'].pos.x + 1, 
            Game.spawns['Spawn1'].pos.y, 
            {align: 'left', opacity: 0.8});
    }
    
    for(var name in Game.creeps) {
        var creep = Game.creeps[name];
        switch(creep.memory.role) {
        case 'harvester':
            roleHarvester.run(creep);
            break;
        case 'upgrader':
            roleUpgrader.run(creep);
            break;
        case 'builder':
            roleBuilder.run(creep);
            break;
        default:
            console.log(name + " has no known role ("+creep.memory.role+")");
        }
    }
    
    for(var name in Game.structures) {
        var struct = Game.structures[name];
        if(struct.structureType != 'tower') { continue; }
        tower.run(struct);
    }
}