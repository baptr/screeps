module.exports = {
run: function(link) {
    var links = link.room.memory.links;
    if(!links) return; // TODO(baptr): Plan these.
    var dest = Game.getObjectById(links.controller);
    if(!dest) return;
    if(dest.id == link.id) return;
    if(link.energy > dest.energy+1) {
        link.transferEnergy(dest);
    }
}
};