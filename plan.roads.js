const searchOpts = {
plainCost: 2,
swampCost: 6, // Expensive to maintain, but we don't want to go too far out of the way.
roomCallback: function(roomName) {
    // TODO(baptr): Cache CostMatrix between runs for multiple destinations.
    // - in part so planned roads can be accounted for
    let room = Game.rooms[roomName];
    if (!room) return;
    // TODO(baptr): Return false if it looks like a dangerous room.
    let costs = new PathFinder.CostMatrix;

    room.find(FIND_STRUCTURES).forEach(s => {
        if(s.structureType === STRUCTURE_ROAD) {
            costs.set(s.pos.x, s.pos.y, 1);
        } else if (s.structureType !== STRUCTURE_CONTAINER &&
                  (s.structureType !== STRUCTURE_RAMPART || !s.my)) {
            costs.set(s.pos.x, s.pos.y, 255);
        }
    });
    room.find(FIND_MY_CONSTRUCTION_SITES, {
        filter: {structureType: STRUCTURE_ROAD}
    }).forEach(s => {
        costs.set(s.pos.x, s.pos.y, 1);
    });

    // TODO(baptr): We don't need to avoid workers, but there might be
    // frequently blocked positions worth avoiding...
    /*
    room.find(FIND_CREEPS).forEach(c => {
        costs.set(c.pos.x, c.pos.y, 100);
    });
    */

    return costs;
}
}

const BUILD = true;

module.exports = {
plan: function(src, dest) {
    var path = PathFinder.search(src, {pos: dest, range: 1}, searchOpts);
    if(!path) return ERR_NO_PATH;
    if(path.incomplete) return ERR_NO_PATH;
    _.forEach(path.path, (pos, idx) => {
        if(idx == 0) return;
        // TODO(CPU): is it cheaper to reuse this?
        let last = path.path[idx-1];
        if(last.roomName != pos.roomName) return;
        let v = new RoomVisual(pos.roomName);
        v.line(last, pos);
        if(BUILD) {
            let rm = Game.rooms[pos.roomName];
            if(rm) {
                let ret = rm.createConstructionSite(pos, STRUCTURE_ROAD);
                switch(ret) {
                case ERR_INVALID_TARGET: // probably already a road
                case OK: // yay
                    break
                default:
                    console.log(`Failed to set road at ${pos}: ${ret}`);
                }
            }
        }
    });
}
};