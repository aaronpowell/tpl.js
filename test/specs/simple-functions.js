describe('Simple functions', function () {
    it('should run a function', function (done) {
        var data = [1, 2, 3, 4, 5];

        tpl(data, function (arr) {
            return arr.reduce(function (x, y) { return x + y; });
        }, 2).then(function (result) {
            expect(result).to.equal(15);
            done();
        });
    });
});