const util = require('util.creep');

class BodyBuilder {
    constructor(base, energyAvailable) {
        this.body = base.slice();
        this.cost = util.bodyCost(base);
        this.energyRemaining = energyAvailable - this.cost;
    }
    
    extend(parts, limit=0) {
        let c = util.bodyCost(parts);
        let i = 0;
        while(c <= this.energyRemaining && this.body.length + parts.length <= MAX_CREEP_SIZE) {
            this.body.push(...parts);
            this.cost += c;
            this.energyRemaining -= c;
            i++;
            if(limit > 0 && i >= limit) {
                break;
            }
        }
        return this.body;
    }
    
    count(part) {
        return _.countBy(this.body)[part] || 0;
    }
    
    // TODO(baptr): parameterize
    sort(order=BODYPART_COST) {
        if(order instanceof Array) {
            let o = {};
            _.forEach(order, (v, i) => o[v] = i);
            order = o;
        }
        this.body.sort((a,b) => order[a] - order[b]);
        return this.body;
    }
}

module.exports = BodyBuilder;