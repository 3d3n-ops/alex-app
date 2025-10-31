# ============================================
# LISTS (Arrays in Python)
# ============================================
# Lists are ordered, mutable collections indexed by position

# Creating a list
fruits = ["apple", "banana", "cherry"]
print("Original list:", fruits)

# Accessing by index (zero-based)
print("First fruit:", fruits[0])
print("Last fruit:", fruits[-1])  # negative indexing from the end

# Adding elements
fruits.append("date")  # add to end
print("After append:", fruits)

# Removing elements
fruits.remove("banana")  # remove by value
print("After remove:", fruits)

# Slicing (getting a portion)
print("First two:", fruits[0:2])

# Iterating
print("\nAll fruits:")
for fruit in fruits:
    print(f"  - {fruit}")


# ============================================
# DICTIONARIES (Key-Value Maps)
# ============================================
# Dictionaries map keys to values, unordered (Python 3.7+ maintains insertion order)

# Creating a dictionary
student = {
    "name": "Alice",
    "age": 20,
    "major": "Computer Science"
}
print("\n\nStudent dictionary:", student)

# Accessing by key
print("Name:", student["name"])
print("Age:", student["age"])

# Adding/updating entries
student["gpa"] = 3.8
student["age"] = 21  # update existing
print("After updates:", student)

# Safe access with .get() (avoids KeyError)
print("Email:", student.get("email", "Not provided"))

# Checking if key exists
if "major" in student:
    print(f"{student['name']} is studying {student['major']}")

# Iterating
print("\nAll student info:")
for key, value in student.items():
    print(f"  {key}: {value}")


# ============================================
# COMBINING THEM: List of Dictionaries
# ============================================
# Very common pattern: a list where each element is a dictionary

students = [
    {"name": "Alice", "age": 20, "gpa": 3.8},
    {"name": "Bob", "age": 22, "gpa": 3.5},
    {"name": "Charlie", "age": 21, "gpa": 3.9}
]

print("\n\nAll students:")
for student in students:
    print(f"  {student['name']} (age {student['age']}): GPA {student['gpa']}")

# Finding a specific student
for student in students:
    if student["name"] == "Bob":
        print(f"\nFound Bob! His GPA is {student['gpa']}")
