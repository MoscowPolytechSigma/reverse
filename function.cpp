#include <iostream>
#include <cstdlib>
#include <ctime>

using namespace std;

class Base {
public:
    virtual void print() { cout << "Base class" << endl; }
    virtual ~Base() = default;
};

class Derived : public Base {
public:
    void print() override { cout << "Derived class" << endl; }
};

// Функция с различными типами параметров
int processValues(int byValue, int& byRef, int* byPointer) {
    // Обращение к this (в методе класса)
    cout << "Processing values..." << endl;

    // Локальные переменные
    int localVar1 = byValue * 2;
    int localVar2 = byRef + 5;

    // Использование sizeof()
    cout << "Size of localVar1: " << sizeof(localVar1) << " bytes" << endl;
    cout << "Size of int: " << sizeof(int) << " bytes" << endl;

    // Обращение к параметрам
    cout << "By value: " << byValue << endl;
    cout << "By reference: " << byRef << endl;
    cout << "By pointer: " << *byPointer << endl;
    cout << "Local var 1: " << localVar1 << endl;
    cout << "Local var 2: " << localVar2 << endl;

    // Возврат значения через return
    return localVar1 + localVar2;
}

// Функция для демонстрации приведения типов
void demonstrateCasting() {
    // Генерация случайных чисел
    srand(time(nullptr));
    int randomInt = rand() % 100 + 1;
    double randomDouble = (rand() % 1000) / 10.0;

    cout << "\n--- Type Casting Demonstration ---" << endl;
    cout << "Original int: " << randomInt << endl;
    cout << "Original double: " << randomDouble << endl;

    // static_cast<> - безопасное приведение типов
    double staticCastResult = static_cast<double>(randomInt);
    cout << "static_cast<int to double>: " << staticCastResult << endl;

    // reinterpret_cast<> - приведение указателей
    int value = randomInt;
    double* reinterpretPtr = reinterpret_cast<double*>(&value);
    cout << "reinterpret_cast<int* to double*>: " << *reinterpretPtr << " (may be garbage)" << endl;

    // dynamic_cast<> - приведение в иерархии наследования
    Base* basePtr = new Derived();
    Base* basePtr2 = new Base();

    Derived* derivedPtr = dynamic_cast<Derived*>(basePtr);
    if (derivedPtr) {
        cout << "dynamic_cast<Base* to Derived*> successful: ";
        derivedPtr->print();
    }

    Derived* derivedPtr2 = dynamic_cast<Derived*>(basePtr2);
    if (!derivedPtr2) {
        cout << "dynamic_cast<Base* to Derived*> failed (as expected)" << endl;
    }

    delete basePtr;
    delete basePtr2;
}

// Функция для работы с динамическим массивом
void demonstrateDynamicArray() {
    cout << "\n--- Dynamic Array Demonstration ---" << endl;

    // Создание массива в динамической памяти
    const int size = 5;
    int* dynamicArray = new int[size];

    // Заполнение массива случайными числами
    cout << "Dynamic array contents: ";
    for (int i = 0; i < size; ++i) {
        dynamicArray[i] = rand() % 100;
        cout << dynamicArray[i] << " ";
    }
    cout << endl;

    // Использование sizeof() с массивом
    cout << "Size of dynamicArray pointer: " << sizeof(dynamicArray) << " bytes" << endl;
    cout << "Size of one array element: " << sizeof(dynamicArray[0]) << " bytes" << endl;

    // Удаление массива
    delete[] dynamicArray;
    cout << "Dynamic array deleted" << endl;
}

class ExampleClass {
private:
    int data;

public:
    ExampleClass(int val) : data(val) {}

    // Метод с обращением к this
    void demonstrateThis() {
        // Явное обращение к this
        cout << "this pointer value: " << this << endl;
        cout << "Data via this->data: " << this->data << endl;
        cout << "Data via (*this).data: " << (*this).data << endl;

        // Неявное использование this
        cout << "Data (implicit this): " << data << endl;
    }

    int getData() const { return data; }
};

int main() {
    srand(time(nullptr));

    // Генерация случайных параметров
    int valueParam = rand() % 50 + 1;
    int refParam = rand() % 50 + 1;
    int pointerParam = rand() % 50 + 1;

    cout << "=== Program Start ===" << endl;

    // Демонстрация передачи параметров
    cout << "\n--- Parameter Passing Demonstration ---" << endl;
    int result = processValues(valueParam, refParam, &pointerParam);
    cout << "Function result: " << result << endl;

    // Демонстрация приведения типов
    demonstrateCasting();

    // Демонстрация динамического массива
    demonstrateDynamicArray();

    // Демонстрация указателя this
    cout << "\n--- 'this' Pointer Demonstration ---" << endl;
    ExampleClass obj(42);
    obj.demonstrateThis();

    cout << "\n=== Program End ===" << endl;
    return 0;
}