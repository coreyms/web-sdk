export const fetcher = (options: {
	fetch?: typeof fetch;
	method: 'POST' | 'GET';
	endpoint: string;
	variables?: object;
}) => {
	const { method, endpoint, variables } = options;

	return (options.fetch ?? fetch)(endpoint, {
		method,
		// a hung connection must surface as an error the game can show, not a spin stuck on STOP
		signal: AbortSignal.timeout(30_000),
		headers: {
			'Content-Type': 'application/json',
		},
		...(method === 'GET' ? {} : { body: JSON.stringify(variables) }),
	});
};
