-- Create database
CREATE DATABASE IF NOT EXISTS library_web CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE library_web;

-- Users for login (Manager/Admin & Librarian)
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('MANAGER','LIBRARIAN') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS readers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  dob DATE NULL,
  address VARCHAR(255) NULL,
  phone VARCHAR(30) NULL,
  barcode VARCHAR(60) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS publishers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS book_titles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(30) NOT NULL UNIQUE,
  title VARCHAR(200) NOT NULL,
  author VARCHAR(150) NOT NULL,
  publish_year INT NULL,
  cover_price INT NOT NULL DEFAULT 0,
  publisher_id INT NULL,
  description TEXT NULL,
  FOREIGN KEY (publisher_id) REFERENCES publishers(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS book_copies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title_id INT NOT NULL,
  barcode VARCHAR(60) NOT NULL UNIQUE,
  status ENUM('AVAILABLE','BORROWED','LOST','DAMAGED') NOT NULL DEFAULT 'AVAILABLE',
  FOREIGN KEY (title_id) REFERENCES book_titles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS damage_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  default_fee INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS borrow_receipts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  reader_id INT NOT NULL,
  librarian_id INT NOT NULL,
  borrow_date DATE NOT NULL,
  FOREIGN KEY (reader_id) REFERENCES readers(id) ON DELETE CASCADE,
  FOREIGN KEY (librarian_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS borrow_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  receipt_id INT NOT NULL,
  copy_id INT NOT NULL,
  due_date DATE NOT NULL,
  return_date DATE NULL,
  late_fee INT NOT NULL DEFAULT 0,
  damage_fee INT NOT NULL DEFAULT 0,
  total_fee INT NOT NULL DEFAULT 0,
  FOREIGN KEY (receipt_id) REFERENCES borrow_receipts(id) ON DELETE CASCADE,
  FOREIGN KEY (copy_id) REFERENCES book_copies(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS borrow_item_damages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  borrow_item_id INT NOT NULL,
  damage_type_id INT NOT NULL,
  fee INT NOT NULL DEFAULT 0,
  FOREIGN KEY (borrow_item_id) REFERENCES borrow_items(id) ON DELETE CASCADE,
  FOREIGN KEY (damage_type_id) REFERENCES damage_types(id) ON DELETE RESTRICT
);

-- Seed damage types (from reference doc list)
INSERT IGNORE INTO damage_types(name, default_fee) VALUES
('Rách', 100000),
('Xé mất trang', 150000),
('Vẽ bậy', 80000),
('Mốc', 70000),
('Mọt', 70000),
('Nát', 120000),
('Cong vênh', 50000);

-- Seed users (password hashes generated below)
INSERT IGNORE INTO users(username, password_hash, role) VALUES
('admin', '$2b$12$LnesQc7FXAsLT0T3EOzVhejCooagqbpOW/GJ25/yWCLIZvo0CFYTa', 'MANAGER'),
('librarian', '$2b$12$eUhCY2Pj/KCJsbHU0rcgFOt5zpZgATufgdUdnjjQ0b/H3SoZCAm0S', 'LIBRARIAN');
