import routes from '../routes/routes';
import { ErrorForbidden, ErrorNotFound } from '../utils/errors';
import { routeResponseFormat, findMatchingRoute, Response, RouteResponseFormat, MatchedRoute } from '../utils/routeUtils';
import { AppContext, Env, HttpMethod } from '../utils/types';
import mustacheService, { isView, View } from '../services/MustacheService';

export default async function(ctx: AppContext) {
	ctx.appLogger().info(`${ctx.request.method} ${ctx.path}`);

	const match: MatchedRoute = null;

	try {
		const match = findMatchingRoute(ctx.path, routes);

		if (match) {
			let responseObject = null;

			const routeHandler = match.route.findEndPoint(ctx.request.method as HttpMethod, match.subPath.schema);
			responseObject = await routeHandler(match.subPath, ctx);

			if (!match.route.public && !ctx.owner) throw new ErrorForbidden();

			if (responseObject instanceof Response) {
				ctx.response = responseObject.response;
			} else if (isView(responseObject)) {
				ctx.response.status = 200;
				ctx.response.body = await mustacheService.renderView(responseObject, {
					notifications: ctx.notifications || [],
					hasNotifications: !!ctx.notifications && !!ctx.notifications.length,
					owner: ctx.owner,
				});
			} else {
				ctx.response.status = 200;
				ctx.response.body = responseObject;
			}
		} else {
			throw new ErrorNotFound();
		}
	} catch (error) {
		if (error.httpCode >= 400 && error.httpCode < 500) {
			ctx.appLogger().error(`${error.httpCode}: ` + `${ctx.request.method} ${ctx.path}` + ` : ${error.message}`);
		} else {
			ctx.appLogger().error(error);
		}

		ctx.response.status = error.httpCode ? error.httpCode : 500;

		const responseFormat = routeResponseFormat(match, ctx);

		if (responseFormat === RouteResponseFormat.Html) {
			ctx.response.set('Content-Type', 'text/html');
			const view: View = {
				name: 'error',
				path: 'index/error',
				content: {
					error,
					stack: ctx.env === Env.Dev ? error.stack : '',
				},
			};
			ctx.response.body = await mustacheService.renderView(view);
		} else { // JSON
			ctx.response.set('Content-Type', 'application/json');
			const r: any = { error: error.message };
			if (ctx.env === Env.Dev && error.stack) r.stack = error.stack;
			if (error.code) r.code = error.code;
			ctx.response.body = r;
		}
	}
}
