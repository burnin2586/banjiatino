const mockEvents: string[] = [];
let mockRegistration: { name: string; componentProvider: () => unknown } | undefined;

jest.mock('react-native-url-polyfill/auto', () => {
  mockEvents.push('polyfill');
  return {};
});

jest.mock('react-native', () => ({
  AppRegistry: {
    registerComponent: jest.fn((name: string, componentProvider: () => unknown) => {
      mockEvents.push('register');
      mockRegistration = { name, componentProvider };
    }),
  },
}));

jest.mock('./App', () => {
  mockEvents.push('app');
  return 'App';
});

jest.mock('./app.json', () => ({ name: 'BanjiaTiaoli' }));

it('loads the URL polyfill before registering the App component', () => {
  require('./index');

  expect(mockEvents).toEqual(['polyfill', 'app', 'register']);
  expect(mockRegistration?.name).toBe('BanjiaTiaoli');
  expect(mockRegistration?.componentProvider()).toBe('App');
});
