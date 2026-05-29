import { RequestHandler } from "express";
import { ResourceNotFoundError } from "../errors";

const notFoundHandler: RequestHandler = (req, res, next) => {
    throw new ResourceNotFoundError("Endpoint not available");
}

export default notFoundHandler;