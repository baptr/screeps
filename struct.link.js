module.exports = {
run: function(link) {
    var dest = Game.getObjectById(link.room.memory.links.controller);
    if(!dest) return;
    if(dest.id == link.id) return;
    if(link.energy == link.energyCapacity) link.transferEnergy(dest);
}
};