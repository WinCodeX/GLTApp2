// lib/cable.ts
import { createConsumer } from '@rails/actioncable';

const cable = createConsumer('ws://192.168.100.73:3000/cable');

export default cable;