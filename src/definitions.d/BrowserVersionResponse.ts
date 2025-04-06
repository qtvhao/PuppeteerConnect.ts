// Interface for the response from /json/version
export interface BrowserVersionResponse {
    Browser: string;
    ProtocolVersion: string;
    UserAgent: string;
    V8Version: string;
    WebKitVersion: string;
    webSocketDebuggerUrl?: string;
}
