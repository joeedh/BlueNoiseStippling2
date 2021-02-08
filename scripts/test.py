class NumberClass:
    __init__(self,  val):
        self.val = val
    
    __mul__(self, b):
        return PyClass(b.val * self.val)
    
    
    
a = NumberClass(1)
b = NumberClass(2)

c = a * b
