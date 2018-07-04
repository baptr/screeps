var roleHarvester = require('role.harvester');
var roleUpgrader = require('role.upgrader');
var roleBuilder = require('role.builder');
var tower = require('role.tower');

console.log('Reloading');
var colonyTargets = [
    {role: "harvester", body: [WORK, CARRY, MOVE, MOVE], target: 2},
    {role: "upgrader", body: [WORK, CARRY, MOVE, MOVE], target: 3},
    {role: "builder", body: [WORK, CARRY, MOVE, MOVE], target: 4},
];

module.exports.loop = function () {

    // Periodic cleanup
    if(Game.time % 20 == 0 && !Game.spawns['Spawn1'].spawning) {
        for(var name in Memory.creeps) {
            if(!Game.creeps[name]) {
                delete Memory.creeps[name];
                console.log('Clearing non-existing creep memory:', name);
            }
        }

        var kinds = _.groupBy(Game.creeps, creep => creep.memory.role);
        _.forEach(colonyTargets, kind => {
            var targets = kinds[kind.role] || [];
            if(targets.length < kind.target) {
                console.log('Only '+targets.length+' '+kind.role+", spawning up to "+kind.target)
                var newName = kind.role + Game.time;
                Game.spawns['Spawn1'].spawnCreep(kind.body, newName, {memory: {role: kind.role}})
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
        tower.run(t);
    }
}