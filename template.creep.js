const BodyBuilder = require('util.bodybuilder');

const ROLE = 'hauler';
module.exports = {
spawn: function(spawn) {
    const room = spawn.room;
    var body = new BodyBuilder([], room.energyAvailable);
    
    var mem = {role: ROLE, life: {}};
    const name = `${ROLE}-${room.name}-${Game.time}`;
    const ret = spawn.spawnCreep(body.body, name, {memory: mem});
    if(ret != OK) {
        console.log(`Failed to spawn ${name}: ${ret});
    }
    return ret;
},
run: function(creep) {
    
},
ROLE,
};