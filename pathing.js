function roomCallback(roomName) {
    const room = Game.rooms[roomName];
    var out = new PathFinder.CostMatrix();
    if(!room) {
        return out;
    }
    var obstacles = room.find(FIND_STRUCTURES);
    _.forEach(obstacles, s => {
        if(OBSTACLE_OBJECT_TYPES.includes(s.structureType)) {
            out.set(s.pos.x, s.pos.y, 255);
        } else if(s.structureType == STRUCTURE_ROAD) {
            out.set(s.pos.x, s.pos.y, 1);
        }
    });
    return out;
}

module.exports = {
roomCallback: roomCallback,
swampCheck: function(src, dest, roomMatrix=null) {
    // XXX will break if this ever tries to span a room.
    // TODO(baptr): Presumably there could be cases where leaving the room
    // could give a better path.
    if(!roomMatrix) {
        roomMatrix = roomCallback(src.roomName);
    }
    var vis = (Game.rooms[src.roomName] || {}).visual;
    if(!vis) {
        console.log('Warning: unable to see for path planning '+src.roomName);
        vis = new RoomVisual(src.roomName);
    }
    // TODO(baptr): Safe to always assume range: 1? I think so.
    var res = PathFinder.search(src, {pos: dest, range: 1}, {roomCallback: () => roomMatrix, swampCost: 2, maxRooms: 1});
    var ret = [];
    var cloneMatrix = roomMatrix.clone();
    // TODO(baptr): can't short-cut the first pass on swamp traversal.
    //if(res.path.length < res.cost) { // Ended up traversing a swamp!
    _.forEach(res.path, (p, i) => {
        cloneMatrix.set(p.x, p.y, 5);
        var prev = res.path[i-1] || src;
        var t = p.lookFor(LOOK_TERRAIN)[0];
        if(t == 'swamp') {
            // TODO(baptr): Ignore it if there's already a road there??
            ret.push(p);
            vis.line(prev, p, {color: '#55ff11'})
        } else {
            vis.line(prev, p);
        }
    })
    //}
    // Do another pass with the first path soft-blocked (by creeps)
    // Maybe weight ~5-10.
    var cloneRes = PathFinder.search(src, {pos: dest, range: 1}, {roomCallback: () => cloneMatrix, swampCost: 2, maxRooms: 1});
    // TODO(baptr): The second pass can be short-circuited, but then you lose visualization.
    //if(cloneRes.path.length < cloneRes.cost) { // Hit another swamp, or had to wait for a creep to move
        _.forEach(cloneRes.path, (p, i) => {
            var prev = cloneRes.path[i-1] || src;
            var t = p.lookFor(LOOK_TERRAIN)[0];
            if(t == 'swamp') {
                ret.push(p);
                vis.line(prev, p, {color: '#11aa00'});
            } else {
                vis.line(prev, p, {color: '#555555'});
            }
        });
    //}
    return ret;
}
};