import os, json, smtplib, shutil, csv, io
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from flask import Flask, send_from_directory, request, jsonify

app = Flask(__name__, static_folder='static')
CONFIG_FILE = os.path.join(os.path.dirname(__file__), 'config.json')


def load_config():
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, encoding='utf-8') as f:
            return json.load(f)
    return {}


def save_config(cfg):
    with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)


@app.route('/')
def index():
    return send_from_directory('static', 'index.html')


@app.route('/data/<path:path>')
def data_files(path):
    return send_from_directory('data', path)


@app.route('/<path:path>')
def static_files(path):
    return send_from_directory('static', path)


@app.route('/api/config', methods=['GET'])
def get_config():
    cfg = load_config()
    return jsonify({
        'reviewer_email': cfg.get('reviewer_email', ''),
        'smtp_user': cfg.get('smtp_user', ''),
        'smtp_password_set': bool(cfg.get('smtp_password', ''))
    })


@app.route('/api/config', methods=['POST'])
def set_config():
    data = request.get_json()
    cfg = load_config()
    for key in ('reviewer_email', 'smtp_user'):
        if key in data:
            cfg[key] = data[key]
    if data.get('smtp_password'):
        cfg['smtp_password'] = data['smtp_password']
    save_config(cfg)
    return jsonify({'ok': True})


@app.route('/api/upload-questions', methods=['POST'])
def upload_questions():
    f = request.files.get('file')
    if not f:
        return jsonify({'ok': False, 'error': 'Файл не выбран'}), 400

    filename = f.filename.lower()
    questions = []

    def _normalize_key(k):
        return (k or '').strip().lower()

    if filename.endswith('.xlsx'):
        try:
            import openpyxl
        except ImportError:
            return jsonify({'ok': False, 'error': 'Установи openpyxl: pip install openpyxl'}), 500

        wb = openpyxl.load_workbook(f)
        ws = wb.active
        rows = list(ws.iter_rows(values_only=True))
        if not rows:
            return jsonify({'ok': False, 'error': 'Файл пустой'}), 400

        headers = [_normalize_key(str(c) if c is not None else '') for c in rows[0]]
        col = {}
        for i, h in enumerate(headers):
            if h in ('term', 'термин'):       col['term']       = i
            elif h in ('level', 'уровень'):   col['level']      = i
            elif h in ('definition', 'определение'): col['definition'] = i

        if len(col) < 3:
            return jsonify({'ok': False, 'error': f'Не найдены нужные колонки. Нашёл: {headers}'}), 400

        for row in rows[1:]:
            term       = str(row[col['term']] or '').strip()
            definition = str(row[col['definition']] or '').strip()
            level      = row[col['level']]
            if term and definition:
                questions.append({'term': term, 'level': int(level or 0), 'definition': definition})

    elif filename.endswith('.csv'):
        content = f.read().decode('utf-8-sig')
        reader  = csv.DictReader(io.StringIO(content))
        for row in reader:
            norm = {_normalize_key(k): v for k, v in row.items()}
            term       = (norm.get('term') or norm.get('термин') or '').strip()
            definition = (norm.get('definition') or norm.get('определение') or '').strip()
            level      = norm.get('level') or norm.get('уровень') or 0
            if term and definition:
                questions.append({'term': term, 'level': int(level or 0), 'definition': definition})
    else:
        return jsonify({'ok': False, 'error': 'Поддерживаются только .xlsx и .csv'}), 400

    if not questions:
        return jsonify({'ok': False, 'error': 'Не найдено ни одного термина в файле'}), 400

    questions_file = os.path.join(os.path.dirname(__file__), 'data', 'questions.json')
    if os.path.exists(questions_file):
        shutil.copy2(questions_file, questions_file + '.bak')
    with open(questions_file, 'w', encoding='utf-8') as out:
        json.dump(questions, out, ensure_ascii=False, indent=2)

    from collections import Counter
    counts = Counter(q['level'] for q in questions)
    return jsonify({'ok': True, 'total': len(questions), 'by_level': dict(sorted(counts.items()))})


@app.route('/api/submit-test', methods=['POST'])
def submit_test():
    cfg = load_config()
    missing = [k for k in ('reviewer_email', 'smtp_user', 'smtp_password') if not cfg.get(k)]
    if missing:
        return jsonify({'ok': False, 'error': 'Почта не настроена. Перейди в раздел «Настройки».'}), 400

    data = request.get_json()
    student_name = data.get('student_name', '—')
    level = data.get('level', '?')
    answers = data.get('answers', [])
    submitted_at = datetime.now().strftime('%d.%m.%Y %H:%M')

    html_body = _build_email_html(student_name, level, answers, submitted_at)

    msg = MIMEMultipart('alternative')
    msg['Subject'] = f'Иайдо — тест — {student_name} — Уровень {level} — {submitted_at}'
    msg['From'] = cfg['smtp_user']
    msg['To'] = cfg['reviewer_email']
    msg.attach(MIMEText(html_body, 'html', 'utf-8'))

    try:
        with smtplib.SMTP('smtp.gmail.com', 587) as s:
            s.ehlo()
            s.starttls()
            s.login(cfg['smtp_user'], cfg['smtp_password'])
            s.send_message(msg)
        return jsonify({'ok': True})
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)}), 500


def _build_email_html(name, level, answers, submitted_at):
    rows = ''
    for i, a in enumerate(answers, 1):
        ans_html = a.get('answer', '') or '<em style="color:#999">нет ответа</em>'
        correct = a.get('correct', '')
        rows += f'''
        <tr>
          <td style="padding:8px;border:1px solid #ddd;text-align:center;color:#666">{i}</td>
          <td style="padding:8px;border:1px solid #ddd">{a.get("question","")}</td>
          <td style="padding:8px;border:1px solid #ddd">{ans_html}</td>
          <td style="padding:8px;border:1px solid #ddd;color:#2d6a4f;font-size:0.9em">{correct}</td>
        </tr>'''

    return f'''<!DOCTYPE html>
<html><body style="font-family:Arial,sans-serif;max-width:860px;margin:0 auto;padding:24px;color:#1a1a1a">
  <h2 style="border-bottom:2px solid #8b0000;padding-bottom:10px;color:#8b0000">Тест по иайдо</h2>
  <table style="margin-bottom:20px;border-collapse:collapse">
    <tr><td style="padding:4px 16px 4px 0;font-weight:bold">Сдающий:</td><td style="padding:4px 0">{name}</td></tr>
    <tr><td style="padding:4px 16px 4px 0;font-weight:bold">Уровень:</td><td style="padding:4px 0">{level}</td></tr>
    <tr><td style="padding:4px 16px 4px 0;font-weight:bold">Дата / время:</td><td style="padding:4px 0">{submitted_at}</td></tr>
  </table>
  <table style="width:100%;border-collapse:collapse">
    <thead>
      <tr style="background:#f5f0eb">
        <th style="padding:8px;border:1px solid #ddd;width:36px">№</th>
        <th style="padding:8px;border:1px solid #ddd">Вопрос</th>
        <th style="padding:8px;border:1px solid #ddd">Ответ сдающего</th>
        <th style="padding:8px;border:1px solid #ddd;color:#2d6a4f">Правильный ответ</th>
      </tr>
    </thead>
    <tbody>{rows}</tbody>
  </table>
</body></html>'''


if __name__ == '__main__':
    print('Iaydo trainer -> http://localhost:5000')
    app.run(debug=True, port=5000)
