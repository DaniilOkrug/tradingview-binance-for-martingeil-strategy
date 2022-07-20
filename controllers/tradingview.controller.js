class TradingViewController {
    async signal(req, res, next) {
        try {
            console.log(req.body);

            const response = 'ok';

            res.json(response);
        } catch (err) {
            console.log(err);
            next();
        }
    }
}

module.export = new TradingViewController;