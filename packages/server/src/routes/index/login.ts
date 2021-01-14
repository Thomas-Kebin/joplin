import { SubPath, redirect } from '../../utils/routeUtils';
import Router from '../../utils/Router';
import { AppContext } from '../../utils/types';
import { formParse } from '../../utils/requestUtils';
import { baseUrl } from '../../config';
import defaultView from '../../utils/defaultView';
import { View } from '../../services/MustacheService';

function makeView(error: any = null): View {
	const view = defaultView('login');
	view.content.error = error;
	view.partials = ['errorBanner'];
	return view;
}

const router: Router = new Router();

router.public = true;

router.get('login', async (_path: SubPath, _ctx: AppContext) => {
	return makeView();
});

router.post('login', async (_path: SubPath, ctx: AppContext) => {
	try {
		const body = await formParse(ctx.req);

		const session = await ctx.models.session().authenticate(body.fields.email, body.fields.password);
		ctx.cookies.set('sessionId', session.id);
		return redirect(ctx, `${baseUrl()}/home`);
	} catch (error) {
		return makeView(error);
	}
});

export default router;
