// Fixed sample checkout info, used by both builds: the checkout template shows it in disabled fields and
// submitCheckout always records it as the order's address (nobody enters real personal data).
// Plain data, importable from Node (build) and the browser.
export const DUMMY_CHECKOUT = {
  email: 'demo@example.com',
  lastName: '山田',
  firstName: '太郎',
  postal: '100-0001',
  prefecture: '東京都',
  city: '千代田区',
  address1: '千代田1-1',
  address2: '',
  phone: '000-0000-0000',
};
