export class HTTPError extends Error {
    status: number;

    constructor(status: number, message: string) {
        super(message);
        this.status = status;
        this.message = message;
    }
}

export class InvalidRequestError extends HTTPError {
    constructor(message?: string) {
        super(400, message ?? "Invalid Request");
    }
}

export class ResourceNotFoundError extends HTTPError {
    constructor(message?: string) {
        super(404, message ?? "Resource not found");
    }
}
