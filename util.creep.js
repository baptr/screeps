function bodyCost(body) {
    return _.sum(body, p => BODYPART_COST[p.type || p]);
}

module.exports = {
bodyCost,
creepReport: function(roomName) {
    const room = Game.rooms[roomName];
    if(!room) {
        console.log(`No visibility into ${roomName}`);
        return false;
    }
    var creeps = room.find(FIND_CREEPS);
    console.log(`${roomName} has ${creeps.length} total creeps`);
    var kinds = _.groupBy(creeps, c => c.memory.role);
    _.forEach(kinds, (v, k) => {
        console.log(`${k}: ${v.length}`);
    });
},
};
