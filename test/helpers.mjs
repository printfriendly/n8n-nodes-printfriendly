// A stand-in for the `this` n8n gives to preSend and postReceive functions. It carries only what
// the node's hooks use: parameters, the node, the item index and two helpers.
export function fakeContext({ params = {}, httpRequest, prepareBinaryData } = {}) {
	const calls = { httpRequest: [], prepareBinaryData: [] };
	const context = {
		calls,
		getNodeParameter(name, fallback) {
			return Object.prototype.hasOwnProperty.call(params, name) ? params[name] : fallback;
		},
		getNode() {
			return {
				name: 'PrintFriendly',
				type: 'n8n-nodes-printfriendly.printFriendly',
				typeVersion: 1,
			};
		},
		getItemIndex() {
			return 0;
		},
		helpers: {
			async httpRequest(options) {
				calls.httpRequest.push(options);
				if (!httpRequest) throw new Error('unexpected httpRequest');
				return httpRequest(options);
			},
			async prepareBinaryData(buffer, fileName, mimeType) {
				calls.prepareBinaryData.push({ buffer, fileName, mimeType });
				if (prepareBinaryData) return prepareBinaryData(buffer, fileName, mimeType);
				return {
					data: buffer.toString('base64'),
					fileName,
					mimeType,
					fileSize: String(buffer.length),
				};
			},
		},
	};
	return context;
}
