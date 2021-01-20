const Connector = async (event) => {
    const serialize = async (request) => {
        const headers = {};

        // eslint-disable-next-line no-restricted-syntax
        for (const entry of request.headers.entries()) {
            const [a, b] = entry;

            headers[a] = b;
        }

        const serialized = {
            url: request.url,
            headers,
            method: request.method,
            mode: request.mode,
            credentials: request.credentials,
            cache: request.cache,
            redirect: request.redirect,
            referrer: request.referrer
        };

        if (request.method !== 'GET' && request.method !== 'HEAD') {
            const body = await request.clone().text();
            serialized.body = body;

            return serialized;
        }
        return serialized;
    };

    const isValidAnswer = (answer) => {
        // Any request resoponse with an error as response or a type property can't be parsed to JSON
        return answer.ok && !answer.type;
    };

    const IsJsonString = (string) => {
        try {
            JSON.parse(string);
        } catch (e) {
            return false;
        }
        return true;
    };

    const {headers, method, url} = event.request;

    const response = {
        headers: {},
        body: null,
        status: null
    };

    const request = {
        headers: {},
        body: null
    };

    const buildBodyObject = (bodyHeaders, body) => {
        // eslint-disable-next-line no-restricted-syntax
        for (const [header, value] of bodyHeaders) {
            request.headers[header] = value;
        }
        // Save the request body.
        request.body = body;
    };

    const buildResponseObject = async (res) => {
        let isImage = false;
        // eslint-disable-next-line no-restricted-syntax
        for (const [header, value] of res.headers) {
            if (value.includes('image')) {
                isImage = true;
            }
            response.headers[header] = value;
        }

        response.status = res.status;

        if (!isImage) {
            if (isValidAnswer(res)) {
                const r = response.json();
                response.body = r;
            }
            const reader = res.body.getReader();
            const encodedResponse = await reader.read();
            
            const stringifiedValue = new TextDecoder('utf-8').decode(
                encodedResponse.value
            );
            response.body = IsJsonString(stringifiedValue) ? stringifiedValue : 'Not a JSON parsable element';
        }
    };

    // Include a way to recognize your server adress, any third party API or any calls you think are worth logging
    // Otherwise you'll be sending to Ammo the calls to gather your builds
    if (!url.includes('socket')) {
        const {body} = await serialize(event.request);

        buildBodyObject(headers, body);

        // Do the actual call to be able to read the server response.
        const actualRequestResponse = await fetch(url, {
            method,
            headers: request.headers,
            body
        });

        await buildResponseObject(actualRequestResponse);


        const data = {
            data: {
                method,
                url,
                request,
                response
            }
        };

        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        };

        try {
            fetch('http://localhost:3001', options);
        } catch (error) {
            console.error(
                'An unexpected error happened while sending data to Ammo server : ',
                error
            );
        }
    }
};

// eslint-disable-next-line no-restricted-globals
self.addEventListener('img', (event) => {
    return Connector(event);
});

// eslint-disable-next-line no-restricted-globals
self.addEventListener('fetch', (event) => {
    return Connector(event);
});
