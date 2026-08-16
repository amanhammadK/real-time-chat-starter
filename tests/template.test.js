import { RealTimeChatStarterServer } from "../src/mcpServer.js";

describe("RealTimeChatStarterServer", () => {
    let server;

    beforeEach(() => {
        server = new RealTimeChatStarterServer();
    });

    test("should initialize server", () => {
        expect(server).toBeDefined();
        expect(server.server).toBeDefined();
    });
});
