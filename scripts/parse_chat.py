import re
import json
import random
import datetime
from collections import Counter
import time

INPUT_FILE = 'scripts/chat_log.txt'
OUTPUT_FILE = 'questions.js'

def parse_chat(filepath):
    messages = []
    # Regex to match: 08/07/2021, 9:29 am - Sender: Message
    pattern = re.compile(r'^(\d{2}/\d{2}/\d{4}),\s+(\d{1,2}:\d{2})\s?([ap]m)\s+-\s+([^:]+):\s+(.+)$', re.IGNORECASE)

    current_message = None

    with open(filepath, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            line = line.replace('\u202f', ' ')

            match = pattern.match(line)
            if match:
                if current_message:
                    current_message['index'] = len(messages)
                    messages.append(current_message)

                date_str, time_str, ampm, sender, text = match.groups()

                if text == '<Media omitted>':
                    current_message = None
                    continue

                dt_str = f"{date_str} {time_str} {ampm}"
                try:
                    dt = datetime.datetime.strptime(dt_str, "%d/%m/%Y %I:%M %p")
                    timestamp = int(dt.timestamp())
                except ValueError:
                    dt = None
                    timestamp = 0

                current_message = {
                    'date': dt, # Keep datetime obj for python logic
                    'date_str': date_str,
                    'timestamp': timestamp, # For JSON
                    'sender': sender,
                    'text': text
                }
            else:
                if current_message:
                    current_message['text'] += "\n" + line

        if current_message:
            current_message['index'] = len(messages)
            messages.append(current_message)

    return messages

def get_context(messages, index):
    ctx = []
    # Get 2 before
    for i in range(max(0, index - 2), index):
        ctx.append(f"{messages[i]['sender']}: {messages[i]['text']}")

    # Placeholder for the question message itself (optional, but maybe useful to skip or mark)
    ctx.append("--- Question Message ---")

    # Get 2 after
    for i in range(index + 1, min(len(messages), index + 3)):
        ctx.append(f"{messages[i]['sender']}: {messages[i]['text']}")

    return ctx

def generate_questions(messages):
    questions = []

    valid_messages = [m for m in messages if m['timestamp'] > 0]
    if not valid_messages:
        return []

    min_time = min(m['timestamp'] for m in valid_messages)
    max_time = max(m['timestamp'] for m in valid_messages)

    senders = list(set(m['sender'] for m in messages))

    # 1. Who said it?
    # Increased to 300 questions
    candidates = [m for m in messages if len(m['text']) > 20 and 'http' not in m['text']]

    for _ in range(300):
        if not candidates: break
        msg = random.choice(candidates)
        candidates.remove(msg)

        correct_sender = msg['sender']
        distractors = [s for s in senders if s != correct_sender]
        if len(distractors) < 3: continue

        options = random.sample(distractors, 3)
        options.append(correct_sender)
        random.shuffle(options)

        questions.append({
            'type': 'who_said_it',
            'question': f'Who said: "{msg["text"]}"?',
            'options': options,
            'correctAnswer': correct_sender,
            'id': f'who_{random.randint(10000, 99999)}',
            'context': get_context(messages, msg['index']),
            'dateDisplay': msg.get('date_str', 'Unknown Date')
        })

    # 2. When did this happen?
    # Increased to 200 questions
    date_candidates = [m for m in valid_messages if len(m['text']) > 30 and 'http' not in m['text']]

    for _ in range(200):
        if not date_candidates: break
        msg = random.choice(date_candidates)
        date_candidates.remove(msg) # unique questions

        questions.append({
            'type': 'when',
            'question': f'When did {msg["sender"]} say: "{msg["text"][:50]}..."?',
            'correctAnswer': msg['timestamp'],
            'min': min_time,
            'max': max_time,
            'id': f'when_{random.randint(10000, 99999)}',
            'context': get_context(messages, msg['index'])
        })

    # 3. Counts
    all_text = " ".join([m['text'].lower() for m in messages])
    words = re.findall(r'\b\w+\b', all_text)
    stopwords = {'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'to', 'of', 'in', 'on', 'at', 'for', 'with', 'it', 'that', 'this', 'i', 'you', 'he', 'she', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'its', 'our', 'their', 'be', 'have', 'do', 'say', 'get', 'make', 'go', 'know', 'take', 'see', 'come', 'think', 'look', 'want', 'give', 'use', 'find', 'tell', 'ask', 'work', 'seem', 'feel', 'try', 'leave', 'call', 'media', 'omitted', 'message', 'deleted', 'pm', 'am', 'can', 'so', 'if', 'as', 'up', 'out', 'one', 'no', 'not', 'all', 'by'}
    filtered_words = [w for w in words if w not in stopwords and len(w) > 3]
    word_counts = Counter(filtered_words)

    # Increased to 120 most common words
    for word, count in word_counts.most_common(120):
        if count < 5: continue
        questions.append({
            'type': 'count',
            'question': f'How many times was the word "{word}" mentioned?',
            'correctAnswer': count,
            'min': 0,
            'max': int(count * 3),
            'id': f'count_{word}_{random.randint(10000, 99999)}'
        })

    sender_counts = Counter(m['sender'] for m in messages)
    for sender, count in sender_counts.items():
        questions.append({
            'type': 'count',
            'question': f'How many messages did {sender} send?',
            'correctAnswer': count,
            'min': 0,
            'max': int(count * 2.5),
            'id': f'msg_count_{random.randint(10000, 99999)}'
        })

    return questions

def main():
    print("Parsing chat log...")
    messages = parse_chat(INPUT_FILE)
    print(f"Parsed {len(messages)} messages.")

    print("Generating questions...")
    questions = generate_questions(messages)
    print(f"Generated {len(questions)} questions.")

    # Custom JSON encoder? No need, basic types.
    # Note: timestamps are integers now.

    js_content = f"window.QUESTION_DATABASE = {json.dumps(questions, indent=2)};"

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write(js_content)
    print(f"Written to {OUTPUT_FILE}")

if __name__ == '__main__':
    main()
