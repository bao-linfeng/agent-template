import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('registers, logs in with an HttpOnly cookie, and returns the authenticated profile', async () => {
    const agent = request.agent(app.getHttpServer());
    const credentials = {
      email: 'user@example.com',
      password: 'password123',
      nickname: 'Example',
    };

    const registration = await agent.post('/auth/register').send(credentials).expect(201);
    expect(registration.body).toEqual({
      id: 1,
      email: credentials.email,
      nickname: credentials.nickname,
    });
    await agent.post('/auth/register').send(credentials).expect(409);

    await agent.get('/user/profile').expect(401);

    const login = await agent
      .post('/auth/login')
      .send({ email: credentials.email, password: credentials.password })
      .expect(201);
    expect(login.body).toEqual({ message: 'Login successful' });
    expect(login.headers['set-cookie'][0]).toContain('HttpOnly');

    const profile = await agent.get('/user/profile').expect(200);
    expect(profile.body).toEqual(registration.body);
    expect(profile.body).not.toHaveProperty('password');
  });

  it('rejects invalid registration input', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'not-an-email', password: 'short', nickname: 'A' })
      .expect(400);
  });

  afterEach(async () => {
    await app.close();
  });
});
