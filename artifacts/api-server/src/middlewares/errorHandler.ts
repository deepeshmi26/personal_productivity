import { ErrorRequestHandler } from "express";

import { HTTPError } from "../errors";

const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
    if (res.headersSent) return next(err);

    if (err instanceof HTTPError) {
        req.log.warn({ err }, "handled error");
        return res.status(err.status).json({ message: err.message, requestId: req.id });
    }

    req.log.error({ err }, "unexpected error");
    return res.status(500).json({ message: "Internal server error", requestId: req.id });
}

export default errorHandler;