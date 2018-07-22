module.exports = {
bodyCost: function(body) {
    return _.sum(body, p => BODYPART_COST[p.type || p]);
}
};