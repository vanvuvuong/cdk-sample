function handler(event) {
    // NOTE: This example function is for a viewer request event trigger.
    // Choose viewer request for event trigger when you associate this function with a distribution.

    var viewer = event.viewer;
    var request = event.request;
    if (viewer.ip in ['113.20.108.37', '222.252.25.178']) {
        return request;
    }
    else {
        var response = {
            statusCode: 403,
            statusDescription: 'Permission Denied',
            headers: {
                'your-ip': { value: viewer.ip }
            }
        };
        return response;
    }
}