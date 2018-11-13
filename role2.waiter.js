const ROLE = 'waiter';

module.exports = {
ROLE,
wait: function(creep, ticks, park=true) {
    if(park) {
        let loc = _.groupBy(creep.pos.look(), 'type');
        console.log(JSON.stringify(loc));
        if(loc.structure.length) { // road or container
            let area = creep.room.lookAtArea(creep.pos.y - 1, creep.pos.x - 1,
                                             creep.pos.y + 1, creep.pos.x + 1);
            let pos;
            _.forEach(area, (row, y) => {
                _.forEach(row, (look, x) => {
                    let found = _.groupBy(look, 'type');
                    if(found.terrain[0].terrain == 'wall') return;
                    if(found.creep) return;
                    if(found.structure) return;
                    pos = new RoomPosition(x, y, creep.room.name);
                    return false;
                });
                if(pos) return false;
            });
            if(pos) {
                console.log(`${creep.name} parking at ${pos}`);
                creep.moveTo(pos);
            }
        }
    }
    creep.memory.waitRole = creep.memory.role;
    creep.memory.waitUntil = Game.time + ticks;
    creep.memory.role = ROLE;
},
run: function(creep) {
    if(Game.time >= creep.memory.waitUntil) {
        creep.memory.role = creep.memory.waitRole;
        delete creep.memory.waitUntil;
        delete creep.memory.waitRole;
    }
}
};