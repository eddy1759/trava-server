import { Router } from 'express';
import authRouter from '../features/auth/auth.route';
import tripRouter from '../features/trip/trip.routes';
import badgeRouter from '../features/gamification/badge.route';
import destinationRouter from '../features/destination/destination.routes';
import expenseRouter from '../features/expense/expense.routes';
import itineraryRouter from '../features/itinerary/itinerary.routes';
import packingListRouter from '../features/packingList/packingList.routes';
import journalEntryRouter from '../features/journalEntry/journalEntry.routes';
import photoRouter from '../features/photo/photo.routes';
import notificationRouter from '../features/notification/notification.routes';
import tripTemplateRouter from '../features/tripTemplate/tripTemplate.routes';
import pointOfInterestRouter from '../features/pointOfInterest/pointOfInterest.routes';
import tripSocialRouter from '../features/tripSocial/tripSocial.routes';
import userRouter from '../features/user/user.routes';
import recommendationRouter from '../features/recommendation/recommendation.routes';
import websocketRouter from '../features/websocket/websocket.routes';
import paymentRouter from '../features/payment/payment.routes';
import premiumRouter from '../features/premium/premium.routes';

const apiRouter = Router();

const featureRoutes = [
    { path: '/auth', route: authRouter },
    { path: '/trips', route: tripRouter },
    { path: '/badges', route: badgeRouter },
    { path: '/destinations', route: destinationRouter },
    { path: '/expenses', route: expenseRouter },
    { path: '/itineraries', route: itineraryRouter },
    { path: '/packing-list', route: packingListRouter },
    { path: '/journal-entries', route: journalEntryRouter },
    { path: '/photos', route: photoRouter },
    { path: '/notifications', route: notificationRouter },
    { path: '/trip-templates', route: tripTemplateRouter },
    { path: '/points-of-interest', route: pointOfInterestRouter },
    { path: '/trip-social', route: tripSocialRouter },
    { path: '/users', route: userRouter },
    { path: '/recommendations', route: recommendationRouter },
    { path: '/websocket', route: websocketRouter },
    { path: '/payments', route: paymentRouter },
    { path: '/premium', route: premiumRouter },
];

featureRoutes.forEach(({ path, route }) => {
    apiRouter.use(path, route);
});

export default apiRouter;